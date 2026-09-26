import axios from 'axios';
import Project from '../models/Project.js';

const githubAPI = axios.create({
  baseURL: 'https://api.github.com',
  headers: {
    'Authorization': `token ${process.env.GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json'
  }
});

export const getRepoDetails = async (owner, repo) => {
  try {
    const response = await githubAPI.get(`/repos/${owner}/${repo}`);
    return {
      name: response.data.name,
      full_name: response.data.full_name,
      description: response.data.description,
      url: response.data.html_url,
      stars: response.data.stargazers_count,
      forks: response.data.forks_count,
      language: response.data.language,
      default_branch: response.data.default_branch
    };
  } catch (error) {
    console.error('GitHub API error:', error);
    throw error;
  }
};

export const createPullRequest = async (owner, repo, title, body, head, base = 'main') => {
  try {
    const response = await githubAPI.post(`/repos/${owner}/${repo}/pulls`, {
      title,
      body,
      head,
      base
    });

    return {
      pr_number: response.data.number,
      url: response.data.html_url,
      state: response.data.state,
      created_at: response.data.created_at
    };
  } catch (error) {
    console.error('GitHub PR creation error:', error);
    throw error;
  }
};

export const createRelease = async (owner, repo, version, body, isDraft = false) => {
  try {
    const response = await githubAPI.post(`/repos/${owner}/${repo}/releases`, {
      tag_name: version,
      name: version,
      body,
      draft: isDraft,
      prerelease: false
    });

    return {
      release_id: response.data.id,
      url: response.data.html_url,
      tag: response.data.tag_name,
      created_at: response.data.created_at
    };
  } catch (error) {
    console.error('GitHub release creation error:', error);
    throw error;
  }
};

export const addPRComment = async (owner, repo, prNumber, comment) => {
  try {
    const response = await githubAPI.post(
      `/repos/${owner}/${repo}/issues/${prNumber}/comments`,
      { body: comment }
    );

    return {
      comment_id: response.data.id,
      url: response.data.html_url
    };
  } catch (error) {
    console.error('GitHub comment error:', error);
    throw error;
  }
};

export const approvePR = async (owner, repo, prNumber, reviewComment) => {
  try {
    const response = await githubAPI.post(
      `/repos/${owner}/${repo}/pulls/${prNumber}/reviews`,
      {
        body: reviewComment,
        event: 'APPROVE'
      }
    );

    return {
      review_id: response.data.id,
      state: response.data.state
    };
  } catch (error) {
    console.error('GitHub PR approval error:', error);
    throw error;
  }
};

export const mergePR = async (owner, repo, prNumber, commitTitle, commitMessage) => {
  try {
    const response = await githubAPI.put(
      `/repos/${owner}/${repo}/pulls/${prNumber}/merge`,
      {
        commit_title: commitTitle,
        commit_message: commitMessage,
        merge_method: 'squash'
      }
    );

    return {
      merged: response.data.merged,
      message: response.data.message,
      sha: response.data.sha
    };
  } catch (error) {
    console.error('GitHub PR merge error:', error);
    throw error;
  }
};

export const getWorkflowStatus = async (owner, repo, workflowId) => {
  try {
    const response = await githubAPI.get(
      `/repos/${owner}/${repo}/actions/workflows/${workflowId}/runs`,
      { params: { per_page: 5 } }
    );

    return response.data.workflow_runs.map(run => ({
      id: run.id,
      name: run.name,
      status: run.status,
      conclusion: run.conclusion,
      url: run.html_url,
      created_at: run.created_at,
      updated_at: run.updated_at
    }));
  } catch (error) {
    console.error('GitHub workflow status error:', error);
    throw error;
  }
};

export const getBranchProtectionStatus = async (owner, repo, branch) => {
  try {
    const response = await githubAPI.get(
      `/repos/${owner}/${repo}/branches/${branch}/protection`
    );

    return {
      protected: true,
      enforce_admins: response.data.enforce_admins,
      required_status_checks: response.data.required_status_checks,
      required_reviews: response.data.required_pull_request_reviews,
      dismissal_restrictions: response.data.dismissal_restrictions
    };
  } catch (error) {
    if (error.response?.status === 404) {
      return { protected: false };
    }
    console.error('GitHub branch protection error:', error);
    throw error;
  }
};

export const linkGitHubPR = async (project, prUrl) => {
  try {
    project.replit_task = project.replit_task || {};
    project.replit_task.github_pr_url = prUrl;

    // Extract PR metadata from URL
    const urlMatch = prUrl.match(/github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/);
    if (urlMatch) {
      const [, owner, repo, prNumber] = urlMatch;

      // Get PR details
      const prResponse = await githubAPI.get(
        `/repos/${owner}/${repo}/pulls/${prNumber}`
      );

      project.replit_task.github_owner = owner;
      project.replit_task.github_repo = repo;
      project.replit_task.github_pr_number = prNumber;
      project.replit_task.github_pr_status = prResponse.data.state;
      project.replit_task.github_pr_created_at = prResponse.data.created_at;
    }

    await project.save();
    return project;
  } catch (error) {
    console.error('GitHub PR linking error:', error);
    throw error;
  }
};

export const syncPRStatus = async (project) => {
  try {
    if (!project.replit_task?.github_pr_url) {
      return null;
    }

    const urlMatch = project.replit_task.github_pr_url.match(
      /github\.com\/(.+?)\/(.+?)\/pull\/(\d+)/
    );

    if (!urlMatch) return null;

    const [, owner, repo, prNumber] = urlMatch;

    const prResponse = await githubAPI.get(
      `/repos/${owner}/${repo}/pulls/${prNumber}`
    );

    project.replit_task.github_pr_status = prResponse.data.state;
    project.replit_task.github_pr_merged = prResponse.data.merged;
    project.replit_task.github_pr_merged_at = prResponse.data.merged_at;

    if (prResponse.data.merged) {
      project.status = 'merged';
    } else if (prResponse.data.state === 'closed') {
      project.status = 'rejected';
    }

    await project.save();

    return {
      status: prResponse.data.state,
      merged: prResponse.data.merged,
      url: prResponse.data.html_url
    };
  } catch (error) {
    console.error('GitHub PR sync error:', error);
    throw error;
  }
};

export const getCodeMetrics = async (owner, repo, branch = 'main') => {
  try {
    // Get repo languages
    const languagesResponse = await githubAPI.get(`/repos/${owner}/${repo}/languages`);

    // Get commits
    const commitsResponse = await githubAPI.get(
      `/repos/${owner}/${repo}/commits`,
      { params: { sha: branch, per_page: 100 } }
    );

    // Get topics/tags
    const repoResponse = await githubAPI.get(`/repos/${owner}/${repo}`);

    return {
      languages: languagesResponse.data,
      total_commits: commitsResponse.data.length,
      topics: repoResponse.data.topics || [],
      last_commit: commitsResponse.data[0]?.commit.committer.date,
      contributors_count: repoResponse.data.network_count
    };
  } catch (error) {
    console.error('GitHub code metrics error:', error);
    throw error;
  }
};

export default {
  getRepoDetails,
  createPullRequest,
  createRelease,
  addPRComment,
  approvePR,
  mergePR,
  getWorkflowStatus,
  getBranchProtectionStatus,
  linkGitHubPR,
  syncPRStatus,
  getCodeMetrics
};
