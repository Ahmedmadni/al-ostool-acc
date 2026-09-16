# خطة ترحيل قاعدة الإنتاج المؤجلة

**حالة قاعدة الإنتاج:** `NOT STARTED`  
**طريقة التنفيذ:** يدويًا داخل Lovable / Supabase SQL Editor  
**أقرب تاريخ مسموح لتغيير Schema:** **27-09-2026 بتوقيت الرياض**

## القاعدة الحاكمة

وجود ملف Migration في GitHub لا يعني أنه مطبق على قاعدة الإنتاج. لا تشغّل جميع الملفات دفعة واحدة، ولا تعِد تشغيل Migration ظهر أنه مطبق أو مطبق جزئيًا.

التنفيذ اليدوي من SQL Editor لا يساوي `supabase db push` ولا يضمن تحديث سجل `supabase_migrations` تلقائيًا. لذلك لا يتم تعديل جدول `supabase_migrations.schema_migrations` يدويًا قبل اكتمال المطابقة الهيكلية واتخاذ قرار صريح بشأن سجل الترحيلات.

## الملفات الجاهزة قبل التنفيذ

- `scripts/production-db/migration-manifest.json`: ترتيب المرشحين على سبع دفعات.
- `scripts/production-db/preflight-readonly.sql`: فحص قراءة فقط قبل أي تغيير.
- `scripts/production-db/postflight-readonly.sql`: فحص قراءة فقط بعد كل دفعة.
- `npm run db:plan`: طباعة الترتيب المرشح دون تنفيذ SQL.
- `npm run check:gate20-db-rollout`: التحقق من سلامة حزمة الانتشار.

## قبل 27-09-2026

لا يتم تنفيذ أي Migration أو DDL أو DML على الإنتاج. المسموح برمجيًا هو مراجعة الملفات، الاختبارات المحلية، البناء، التوثيق، وتجهيز حزم التنفيذ فقط.

## يوم التنفيذ

1. تأكد من فتح مشروع Supabase الصحيح المتصل بتطبيق Lovable.
2. خذ نسخة احتياطية قابلة للاستعادة قبل أول تغيير.
3. أوقف أي نشر متزامن أو تنفيذ SQL من شخص آخر.
4. شغّل `preflight-readonly.sql` كاملًا.
5. احفظ كل Result Set وأرسله للمراجعة.
6. لا تبدأ أي Migration إذا ظهرت حالة `PARTIALLY_APPLIED` أو prerequisite مفقود.
7. بعد المراجعة يُحدد فقط ما هو Pending، وبالترتيب الموجود في Manifest.
8. شغّل Migration واحدًا أو دفعة معتمدة فقط.
9. احتفظ برسالة `Query succeeded`، ثم شغّل Postflight.
10. لا تنتقل للدفعة التالية قبل اعتماد نتيجة Postflight.

## ترتيب الدفعات المرشح

| الدفعة | المحتوى | عدد المرشحين |
|---|---|---:|
| 01 | HR والحضور وربط الرواتب بالتكاليف | 4 |
| 02 | محاسبة التكاليف ومحرك VAT | 4 |
| 03 | Holding وMulti-company | 1 |
| 04 | التشغيل والصيانة | 5 |
| 05 | العقارات وإدارة المرافق | 5 |
| 06 | خدمة العملاء وشركة التقنية | 3 |
| 07 | تقوية محرك الزكاة | 1 |

الإجمالي **23 Migration مرشحًا**، وليس 23 ملفًا واجب التنفيذ بالضرورة.

## شروط التوقف الفوري

- المشروع المفتوح لا يطابق مشروع Lovable الفعلي.
- فشل النسخ الاحتياطي.
- وجود Migration مطبق جزئيًا.
- فقدان جدول أو عمود prerequisite.
- Lock timeout أو تنفيذ متزامن.
- خطأ صلاحيات أو RLS.
- نتيجة مختلفة عن الاختبارات المحلية.
- أي أمر `DROP` أو `TRUNCATE` غير متوقع.
- أي خطأ؛ لا تعِد المحاولة قبل تحليل السبب.

## دليل التنفيذ المطلوب لكل Migration

| الحقل | القيمة |
|---|---|
| Version | |
| File | |
| Started at | |
| Finished at | |
| SQL Editor result | Query succeeded / Error |
| Postflight result | PASS / BLOCKED |
| Evidence saved | نعم / لا |
| Notes | |

## الإغلاق النهائي

لا تتحول الحالة إلى `DB VERIFIED` إلا بعد:

- عدم وجود Expected Object مفقود.
- تفعيل RLS على كل الجداول الجديدة.
- مراجعة ACL للدوال والجداول.
- تثبيت `search_path` لكل دالة `SECURITY DEFINER`.
- اجتياز اختبارات HR → Payroll → Cost.
- اجتياز VAT وZakat.
- اجتياز Maintenance وReal Estate وCustomer Service وIT.
- فحص Security Advisor وPerformance Advisor.
- إعادة توليد TypeScript Types من القاعدة الحية ومقارنتها بالمستودع.
- توثيق جميع نتائج التنفيذ.

مرجع Supabase: https://supabase.com/docs/guides/deployment/database-migrations
