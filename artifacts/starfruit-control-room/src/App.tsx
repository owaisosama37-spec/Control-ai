import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { ClerkProvider, SignIn, SignUp, useUser, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
import { arSA } from "@clerk/localizations";
import { LocaleProvider, useLocale } from "@/lib/locale";
import { Router, Switch, Route, Link, Redirect, useLocation } from "wouter";
import { LayoutDashboard, Layers, CheckCheck, ScrollText, Plug, LogOut, ShieldCheck, Menu, X, ArrowUpRight, GitBranch, LockKeyhole, Activity, ListTodo } from "lucide-react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/toaster";
import { DashboardPage, ProjectsPage, ProjectPage, ActivityPage, SettingsPage } from "@/pages/room";
import { OrchestrationPage } from "@/pages/orchestration";
import NotFound from "@/pages/not-found";
import { TeamBoundary, TeamPage } from "@/components/team";
import { setRoomOwner } from "@workspace/api-client-react";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const client = new QueryClient({ defaultOptions: { queries: { staleTime: 10000, refetchInterval: 20000, retry: 1 } } });
export function Brand() {
  const { t } = useLocale();
  return <Link href="/" className="brand" data-testid="link-brand"><img src={`${basePath}/logo.svg`} alt="" /><span>starfruit<small>{t("Control room")}</small></span></Link>;
}
function LanguageButton() {
  const {language,setLanguage} = useLocale();
  return <button type="button" className="btn ghost small" aria-label={language==="ar" ? "Switch to English" : "التبديل إلى العربية"} onClick={()=>setLanguage(language==="ar"?"en":"ar")} data-testid="button-language">{language==="ar"?"English":"العربية"}</button>;
}
function CacheBoundary() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const previous = useRef<string | null | undefined>(undefined);
  useEffect(() => addListener(({ user }) => {
    const id = user?.id ?? null;
    if (previous.current !== undefined && previous.current !== id) { setRoomOwner(null); queryClient.clear(); }
    previous.current = id;
  }), [addListener, queryClient]);
  return null;
}
function Landing() {
  const { t } = useLocale();
  const { isSignedIn, isLoaded } = useUser();
  if (!isLoaded) return <div className="auth-page"><Brand /><p className="muted">{t("Loading your room…")}</p></div>;
  if (isSignedIn) return <Redirect to="/dashboard" />;
  return <div className="landing">
    <nav><Brand /><div className="flex items-center gap-2"><LanguageButton /><Link className="btn ghost" href="/sign-in" data-testid="link-sign-in">{t("Sign in")} <ArrowUpRight size={16} /></Link></div></nav>
    <section className="hero">
      <div><div className="eyebrow">{t("Software delivery, under control")}</div><h1>{t("Big ideas.")}<br />{t("Clear decisions.")}<br /><em>{t("One control room.")}</em></h1>
        <p>{t("Bring your projects, approval decisions, and delivery budgets together. Know what’s moving — and what needs your attention.")}</p>
        <div className="hero-ctas"><Link href="/sign-up" className="btn primary" data-testid="link-start">{t("Create your control room")} <ArrowUpRight size={17} /></Link><span className="muted text-xs">{t("Private by default. Built for focus.")}</span></div>
      </div>
      <div className="flow-preview" aria-label={t("Workflow overview, not live project data")}>
        <div className="panel-head"><span className="eyebrow">{t("Your delivery workflow")}</span><GitBranch size={18} className="text-primary" /></div>
        {[["Define the brief","Capture the scope, client, and budget."],["Approve the plan","Make the decision before work begins."],["Review the delivery","Keep quality and approval visible."],["Mark it merged","Close the loop with a signed record."]].map(([title,description],i)=><div className="flow-step" key={title}><span className="step-number">0{i+1}</span><div><strong>{t(title)}</strong><small>{t(description)}</small></div></div>)}
        <div className="mt-5 text-[10px] muted">{t("Human-led workflows · Automatic agent execution not enabled")}</div>
      </div>
    </section>
    <section className="feature-band">
      {[[Layers,"A single project view","From first draft to final review. Keep priorities, context, and cost alongside the work."],[ShieldCheck,"Decisions with a record","Status changes are recorded with signed activity, so the history stays clear."],[LockKeyhole,"Your private workspace","Secure sign-in and account-isolated project data, persisted in MongoDB."]].map(([Icon,title,text])=> { const I = Icon as typeof Layers; return <div key={String(title)}><I size={23} className="text-primary" /><h3>{t(String(title))}</h3><p>{t(String(text))}</p></div>; })}
    </section>
  </div>;
}
const navigation = [
  ["/dashboard","Overview",LayoutDashboard], ["/projects","Projects",Layers],
  ["/orchestration","Task plans",ListTodo],
  ["/approvals","Approvals",CheckCheck], ["/activity","Activity log",ScrollText], ["/settings","Connections",Plug],
  ["/team","Team & access",ShieldCheck],
] as const;
function Room() {
  const { t } = useLocale();
  const { isSignedIn, isLoaded, user } = useUser();
  const { signOut } = useClerk();
  const [location] = useLocation();
  const [open,setOpen] = useState(false);
  useEffect(() => { setOpen(false); document.title = `${t(navigation.find(([path])=>location.startsWith(path))?.[1] || "Project")} · Starfruit`; }, [location,t]);
  if (!isLoaded) return <div className="auth-page"><Brand /><p>{t("Loading…")}</p></div>;
  if (!isSignedIn) return <Redirect to="/" />;
  return <div className="shell">
    <aside className={`sidebar ${open ? "open" : ""}`}><Brand />
      <button className="btn ghost mobile-menu" onClick={()=>setOpen(false)} aria-label={t("Close navigation")} data-testid="button-close-menu"><X size={18} /></button>
      <div className="nav-caption">{t("WORKSPACE")}</div><nav>{navigation.map(([path,label,Icon])=><Link key={path} href={path} className={`nav-link ${location.startsWith(path) ? "active" : ""}`} data-testid={`nav-${label}`}><Icon size={18} />{t(label)}</Link>)}</nav>
      <div className="sidebar-bottom"><div className="private-badge"><ShieldCheck size={17} className="mb-2 text-primary" /><strong>{t("Access-controlled rooms")}</strong><br />{t("Private until explicitly shared.")}<br />{t("Permissions enforced by role.")}</div>
        <button className="nav-link w-full" onClick={()=>signOut({ redirectUrl: basePath || "/" })} data-testid="button-sign-out"><LogOut size={17} />{t("Sign out")}</button></div>
    </aside>
    <div className="min-w-0"><header className="topbar"><button className="btn ghost mobile-menu" onClick={()=>setOpen(true)} aria-label={t("Open navigation")} data-testid="button-menu"><Menu size={19} /></button><div className="topbar-label"><Activity size={15} /> STARFRUIT <span className="opacity-40">/</span> {t("Workspace")}</div><div className="topbar-right"><span className="eyebrow hidden sm:block">{t("Manual operations")}</span><LanguageButton /><div className="avatar" title={user?.fullName || t("Your account")}>{user?.firstName?.[0] || "S"}</div></div></header>
      <main className="page"><TeamBoundary key={user!.id}><Switch>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/projects">{()=><ProjectsPage />}</Route>
        <Route path="/projects/:id">{params=><ProjectPage id={params.id} />}</Route>
        <Route path="/orchestration" component={OrchestrationPage} />
        <Route path="/approvals">{()=><ProjectsPage approvals />}</Route>
        <Route path="/activity" component={ActivityPage} />
        <Route path="/settings" component={SettingsPage} />
        <Route path="/team" component={TeamPage} />
        <Route component={NotFound} />
      </Switch></TeamBoundary></main>
    </div>
  </div>;
}
function ClerkRoutes() {
  const { language,t } = useLocale();
  const [,setLocation] = useLocation();
  const stripBase = (path:string) => basePath && path.startsWith(basePath) ? path.slice(basePath.length) || "/" : path;
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl}
    signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`}
    signInFallbackRedirectUrl={`${basePath}/dashboard`} signUpFallbackRedirectUrl={`${basePath}/dashboard`}
    routerPush={to=>setLocation(stripBase(to))} routerReplace={to=>setLocation(stripBase(to),{replace:true})}
    localization={language==="ar" ? {
      ...arSA,
      formFieldInputPlaceholder__emailAddress:"أدخل بريدك الإلكتروني",
      signIn:{...arSA.signIn,start:{...arSA.signIn?.start,title:"مرحبًا بعودتك",subtitle:"سجّل الدخول إلى غرفة تحكم Starfruit"}},
      signUp:{...arSA.signUp,start:{...arSA.signUp?.start,title:"ابدأ رحلتك من هنا",subtitle:"أنشئ مساحة Starfruit الخاصة بك"}},
    } : {signIn:{start:{title:t("Welcome back"),subtitle:t("Sign in to your Starfruit control room")}},signUp:{start:{title:t("Your next chapter starts here"),subtitle:t("Create your private Starfruit workspace")}}}}
    appearance={{ theme: dark, cssLayerName:"clerk",
      options:{logoImageUrl:`${window.location.origin}${basePath}/logo.svg`,logoPlacement:"inside",logoLinkUrl:basePath || "/"},
      variables:{colorPrimary:"#d2ed88",colorForeground:"#edf0e9",colorMutedForeground:"#a6b59a",colorBackground:"#1a2418",colorInput:"#131c12",colorInputForeground:"#edf0e9",colorDanger:"#eeaaaa",colorNeutral:"#c5d3bc",fontFamily:"DM Sans, sans-serif",borderRadius:"10px"},
      elements:{rootBox:{width:"min(440px, calc(100vw - 40px))",maxWidth:"100%"},cardBox:{background:"#1a2418",width:"100%",maxWidth:"100%"},formButtonPrimary:{color:"#203019"},card:{background:"transparent"},footer:{background:"transparent"},headerTitle:{color:"#edf0e9"},headerSubtitle:{color:"#a6b59a"},formFieldLabel:{color:"#edf0e9"},footerActionText:{color:"#a6b59a"},footerActionLink:{color:"#d2ed88"},socialButtonsBlockButtonText:{color:"#edf0e9"},dividerText:{color:"#a6b59a"}},
    }}>
    <QueryClientProvider client={client}><CacheBoundary /><TooltipProvider><Switch>
      <Route path="/" component={Landing} />
      <Route path="/sign-in/*?">{()=><div className="auth-page"><div className="flex items-center gap-5"><Brand /><LanguageButton /></div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div>}</Route>
      <Route path="/sign-up/*?">{()=><div className="auth-page"><div className="flex items-center gap-5"><Brand /><LanguageButton /></div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div>}</Route>
      <Route><Room /></Route>
    </Switch><Toaster /></TooltipProvider></QueryClientProvider>
  </ClerkProvider>;
}
export default function App() { return <LocaleProvider><Router base={basePath}><ClerkRoutes /></Router></LocaleProvider>; }