## المشكلة

**خطأ التعليقات:** الكود في `src/routes/_authenticated/tasks/$id.tsx` يستخدم عمود `author_id` بينما العمود الفعلي في جدول `task_comments` اسمه `user_id`.

**خطأ "بدء العمل":** سياسة الكتابة `rbac_write` على جدول `tasks` تتطلب أحد أدوار `can_write_operations` (admin/cfo/finance_manager/chief_accountant/accountant/project_manager/cost_controller). الموظف المُكلَّف الذي لا يملك أحد هذه الأدوار لا يستطيع تحديث حالة مهمته الخاصة.

## الإصلاح

### 1. تصحيح اسم العمود في الواجهة
في `src/routes/_authenticated/tasks/$id.tsx` استبدال `author_id` بـ `user_id` في:
- الـ INSERT (السطر 148)
- قراءة `c.author_id` عند عرض التعليقات (السطران 309، 310)

### 2. ترحيل قاعدة البيانات (Migration)
إضافة سياسات RLS تسمح للمُكلَّف ومنشئ المهمة بتحديث مهامهم:

```sql
-- السماح للمكلَّف بتحديث حالة/تقدم مهمته
CREATE POLICY tasks_assignee_update ON public.tasks
  FOR UPDATE TO authenticated
  USING (assigned_to = auth.uid() OR created_by = auth.uid())
  WITH CHECK (assigned_to = auth.uid() OR created_by = auth.uid());
```

السياسة الحالية `rbac_write` تبقى للأدوار الإدارية. السياسات في PostgreSQL تعمل بمنطق OR، لذا الموظف العادي يستطيع تحديث مهامه فقط، والمدراء يحتفظون بصلاحيتهم الكاملة.

## الملفات المتأثرة
- تعديل: `src/routes/_authenticated/tasks/$id.tsx`
- إنشاء: migration جديد لإضافة سياسة UPDATE للمكلَّف على `tasks`
