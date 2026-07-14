# Firebase Authentication — Activation Guide

> الحالة: **Feature Ready but Disabled**
> الكود مكتوب بالكامل وجاهز. المطلوب فقط: تفعيل الخدمات في Firebase Console + نشر Functions.

## ما هو الجاهز الآن؟

| المكوّن | الحالة | مكانه |
|---------|--------|-------|
| Firebase App + Auth initialization | ✅ جاهز | `services/firebase.ts` |
| Merchant Auth (Firebase → Legacy Fallback) | ✅ جاهز | `authFirebase.ts` |
| Admin Auth (Firebase → Legacy Fallback) | ✅ جاهز | `authFirebase.ts` + `admin/app.js` |
| UI: status badge + activation button | ✅ جاهز | `admin/modules/accounts.js` |
| Cloud Functions (4 دوال Provisioning) | ✅ جاهز — غير منشور | `functions/provisionAuth.js` |
| Legacy system | ✅ يعمل بكامل طاقته | غير متأثر |

## خطوات التفعيل (بالترتيب)

### 1. Firebase Console
- Enable **Email/Password** في Authentication > Sign-in method
- (اختياري) إنشاء مستخدم Admin يدوياً مسبقاً

### 2. ترقية Blaze (إذا لزم الأمر)
- Cloud Functions v2 تحتاج Blaze plan
- التحقق من `firebase deploy --only functions`

### 3. نشر Cloud Functions
```bash
firebase deploy --only functions
```
- ينشر 4 دوال: `provisionMerchantAuth`, `provisionAdminAuth`, `migrateAllMerchants`, `checkMigrationStatus`

### 4. إنشاء Admin Firebase
- عبر `provisionAdminAuth` أو يدوياً في Console
- تعيين Custom Claim: `{ role: "admin" }`

### 5. تفعيل تاجر تجريبي
- افتح Admin Panel > الحسابات > اختر تاجر > زر "🔐 تفعيل Firebase Authentication"
- أو استدعِ `provisionMerchantAuth(merchantId, phone, email)` يدوياً

### 6. الاختبارات
- تسجيل دخول Admin عبر Firebase
- تسجيل دخول تاجر عبر Firebase
- Legacy Fallback عند تعطيل Firebase
- انقطاع الإنترنت → Fallback
- Token منتهي الصلاحية
- Missing Claims → رفض

### 7. نشر Security Rules (في مرحلة لاحقة)
```bash
firebase deploy --only firestore:rules
```

## الملفات المتأثرة عند التفعيل

| الملف | التغيير |
|-------|---------|
| `admin/index.html` | ✅ compat scripts محملة مسبقاً — لا تغيير |
| `admin/app.js` | ✅ كود Firebase Auth جاهز — لا تغيير |
| `admin/modules/accounts.js` | ✅ UI جاهز — لا تغيير |
| `modules/merchant/firebase/authFirebase.ts` | ✅ جاهز — لا تغيير |
| `modules/merchant/hooks/useMerchantAuth.ts` | ✅ جاهز — لا تغيير |
| `functions/provisionAuth.js` | فقط يحتاج نشر |
| `firestore.rules` | **يحتاج إنشاء** — Phase 4 |
| `firebase.json` | **يحتاج تحديث** — Phase 4 |

**لا حاجة لتعديل أي ملف.** كل ما هو مطلوب: تفعيل الخدمات + نشر Functions.

## آلية الحماية (Feature is Disabled)

جميع مسارات Firebase Auth محمية بوجود حقول شرطية غير موجودة حالياً:

| المسار | الشرط | السبب |
|--------|-------|-------|
| Admin Firebase Login | `credData.firebaseEmail` موجود | الحقل غير موجود في Firestore |
| Merchant Firebase Login | `merchant.firebaseAuthUid && merchant.email` | الحقول غير موجودة لأي تاجر |
| Provisioning UI | Cloud Functions غير منشورة | استدعاء HTTPS Callable يفشل برسالة خطأ |

**النتيجة**: النظام يعمل 100% على Legacy Authentication فقط.

## خطوات Rollback (في حال التفعيل)

| السيناريو | الإجراء |
|-----------|---------|
| Firebase Auth معطل | Legacy fallback تلقائي — لا تدخل يدوي |
| Cloud Functions تالفة | `firebase functions:delete provisionMerchantAuth` |
| Provisioning فشل | لا تأثير — التاجر بلا Firebase فقط |
| Admin لا يستطيع تسجيل الدخول | استخدم Legacy (نفس username/password) — لا حاجة لتعديل |
| كارثة | `firebase deploy --only functions` باستخدام نسخة سابقة |
