import { Link } from "wouter";
import { useLocale } from "@/lib/locale";

export default function NotFound() {
  const {language}=useLocale();
  return <div className="panel empty">
    <div className="eyebrow">404</div>
    <h1>{language==="ar" ? "الصفحة غير موجودة" : "Page not found"}</h1>
    <p>{language==="ar" ? "الرابط الذي فتحته لا يشير إلى صفحة في غرفة التحكم." : "This link doesn't point to a page in your control room."}</p>
    <Link href="/dashboard" className="btn primary">{language==="ar" ? "العودة إلى النظرة العامة" : "Back to overview"}</Link>
  </div>;
}