import { FormEvent, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Send, ShieldCheck } from "lucide-react";

type CompanyCode = "OM" | "RE" | "CORE";

type Props = {
  companyCode: CompanyCode;
};

const requestTypes: Record<CompanyCode, Array<{ value: string; label: string }>> = {
  OM: [
    { value: "maintenance", label: "طلب صيانة" },
    { value: "facility", label: "طلب تشغيل / مرافق" },
    { value: "complaint", label: "شكوى أو ملاحظة" },
    { value: "general", label: "طلب عام" },
  ],
  RE: [
    { value: "leasing_enquiry", label: "استفسار تأجير" },
    { value: "property_enquiry", label: "استفسار عقاري" },
    { value: "facility", label: "طلب مرافق / صيانة وحدة" },
    { value: "complaint", label: "شكوى أو ملاحظة" },
    { value: "general", label: "طلب عام" },
  ],
  CORE: [
    { value: "complaint", label: "شكوى أو ملاحظة" },
    { value: "general", label: "طلب عام" },
  ],
};

export function PublicServiceRequestForm({ companyCode }: Props) {
  const options = requestTypes[companyCode];
  const initialType = options[0]?.value ?? "general";
  const [requestType, setRequestType] = useState(initialType);
  const [priority, setPriority] = useState("normal");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [ticketNo, setTicketNo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestKey = useMemo(() => crypto.randomUUID(), [ticketNo]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!contactPhone.trim() && !contactEmail.trim()) {
      setError("أدخل رقم الجوال أو البريد الإلكتروني حتى يتمكن فريق الخدمة من التواصل معك.");
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/public/service-request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          companyCode,
          requestType,
          contactName,
          contactPhone,
          contactEmail,
          title,
          description,
          priority,
          requestKey,
          website,
        }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (result?.error === "service_not_activated" || result?.error === "service_unavailable") {
          throw new Error("مركز الطلبات جاهز في الموقع وسيصبح متاحًا فور تطبيق قاعدة البيانات النهائية.");
        }
        if (result?.error === "rate_limited") throw new Error("تم إرسال عدد كبير من الطلبات. حاول مرة أخرى لاحقًا.");
        throw new Error("تعذر إرسال الطلب الآن. راجع البيانات وحاول مرة أخرى.");
      }
      setTicketNo(result.ticketNo ?? null);
      if (!result.ticketNo) throw new Error("تم استلام الطلب لكن تعذر إظهار رقم المتابعة.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "تعذر إرسال الطلب الآن.");
    } finally {
      setSubmitting(false);
    }
  }

  if (ticketNo) {
    return (
      <div className="rounded-3xl border border-emerald-300/25 bg-emerald-300/10 p-6 text-right">
        <CheckCircle2 className="h-8 w-8 text-emerald-300" />
        <h3 className="mt-4 text-xl font-black">تم استلام طلبك بنجاح</h3>
        <p className="mt-2 text-sm leading-7 text-slate-300">احتفظ برقم المتابعة التالي عند التواصل مع فريق الخدمة.</p>
        <div className="mt-4 inline-flex rounded-xl border border-emerald-300/20 bg-black/20 px-4 py-3 font-mono text-lg font-black text-emerald-200">{ticketNo}</div>
        <div><button type="button" onClick={() => setTicketNo(null)} className="mt-5 text-sm font-bold text-amber-200 hover:text-amber-100">إرسال طلب آخر</button></div>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="rounded-3xl border border-white/10 bg-black/15 p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-300/10 text-amber-200"><ShieldCheck className="h-5 w-5" /></span>
        <div>
          <h3 className="font-black">نموذج طلب الخدمة</h3>
          <p className="mt-1 text-xs leading-6 text-slate-400">بعد الإرسال تحصل على رقم متابعة موحد ويرتبط الطلب بالشركة والفريق المختص.</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="نوع الطلب">
          <select value={requestType} onChange={(e) => setRequestType(e.target.value)} className="input-public">
            {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </Field>
        <Field label="الأولوية">
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="input-public">
            <option value="low">منخفضة</option><option value="normal">عادية</option><option value="high">مرتفعة</option><option value="critical">طارئة / حرجة</option>
          </select>
        </Field>
        <Field label="الاسم *"><input required maxLength={200} value={contactName} onChange={(e) => setContactName(e.target.value)} className="input-public" /></Field>
        <Field label="الجوال"><input inputMode="tel" maxLength={40} value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className="input-public" /></Field>
        <Field label="البريد الإلكتروني"><input type="email" maxLength={320} value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className="input-public" /></Field>
        <Field label="عنوان الطلب *"><input required minLength={3} maxLength={300} value={title} onChange={(e) => setTitle(e.target.value)} className="input-public" /></Field>
      </div>
      <Field label="التفاصيل" className="mt-4"><textarea rows={4} maxLength={8000} value={description} onChange={(e) => setDescription(e.target.value)} className="input-public resize-y" /></Field>
      <div className="hidden" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
      {error && <div className="mt-4 rounded-xl border border-red-300/20 bg-red-400/10 p-3 text-sm text-red-100">{error}</div>}
      <button disabled={submitting} type="submit" className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-amber-300 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {submitting ? "جارٍ إرسال الطلب..." : "إرسال والحصول على رقم متابعة"}
      </button>
      <style>{`.input-public{width:100%;border-radius:.75rem;border:1px solid rgba(255,255,255,.12);background:rgba(2,6,23,.55);padding:.7rem .85rem;color:white;outline:none}.input-public:focus{border-color:rgba(252,211,77,.55)}.input-public option{background:#0f172a}`}</style>
    </form>
  );
}

function Field({ label, children, className = "" }: { label: string; children: React.ReactNode; className?: string }) {
  return <label className={`block text-right ${className}`}><span className="mb-1.5 block text-xs font-bold text-slate-300">{label}</span>{children}</label>;
}
