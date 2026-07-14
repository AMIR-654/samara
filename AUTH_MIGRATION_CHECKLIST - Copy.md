# Firebase Authentication — Migration Checklist

> المشروع: Samara Merchant Accounting System  
> التاريخ: يوليو 2026  
> الحالة: **لم يبدأ — في انتظار الموافقة**

---

## 1. الملفات التي ستتغير

### 1.1 Admin Panel

| الملف | التغيير | المخاطرة |
|-------|---------|----------|
| `admin/index.html` | + إضافة `<script src="firebase-auth-compat.js">` | منخفضة — إضافة Script فقط |
| `admin/app.js` | + تعديل `handleLogin()` لاستخدام `firebase.auth().signInWithEmailAndPassword()` | **متوسطة** — يجب الاحتفاظ بـ Custom Auth القديم كـ Fallback |
| `admin/app.js` | + تعديل `init()` لإضافة مستمع `firebase.auth().onAuthStateChanged()` | منخفضة — يشتغل بالتوازي مع النظام الحالي |
| `admin/modules/merchants.js` | + إضافة `provisionMerchantAuthUser()` — خدمة Provisioning مستقلة (رقم 2 أدناه) | منخفضة — لا تُستدعى تلقائياً، بل يدوياً بعد إنشاء التاجر |
| `admin/style.css` | بدون تغيير | — |

### 1.2 Merchant App

| الملف | التغيير | المخاطرة |
|-------|---------|----------|
| `modules/merchant/authFirebase.ts` | + إضافة Firebase Auth كـ option جديد | **متوسطة** — الاحتفاظ بـ Custom Auth القديم كـ Fallback |
| `modules/merchant/context/merchantContext.tsx` | + إضافة `signInWithFirebaseAuth()` بجانب `signIn()` الحالي | منخفضة |
| `services/firebase.ts` | بدون تغيير | — |

### 1.3 Cloud Functions (جديدة)

| الملف | الوظيفة | المخاطرة |
|-------|---------|----------|
| `functions/provisionAuth.js` | **جديد** — خدمة Provisioning مستقلة (رقم 2 أدناه) | — |
| `functions/verifyAuth.js` | **جديد** — التحقق من صحة الـ Custom Claims | — |
| `functions/migrateMerchants.js` | **جديد** — Script ترحيل التجار الحاليين (يُشغل يدوياً) | — |

### 1.4 جديد — بعد اكتمال Auth

| الملف | متى |
|-------|-----|
| `firestore.rules` | فقط بعد اختبار Auth بالكامل |
| `firestore.indexes.json` | فقط بعد اختبار Auth بالكامل |
| تعديل `firebase.json` | فقط بعد اختبار Auth بالكامل |

---

## 2. Collections المتأثرة

| Collection | نوع التأثير | التفاصيل |
|-----------|------------|----------|
| `merchants` | **قراءة فقط** — لا يُضاف أو يُحذف أي حقل. الـ `uid` من Firebase Auth يُخزن في Custom Claim وليس في Firestore | |
| `settings/admin_credentials` | بدون تغيير — يبقى للنظام القديم كـ Fallback | |
| `merchant_admin/credentials` | بدون تغيير — يبقى للنظام القديم كـ Fallback | |
| جميع Collections الأخرى | بدون أي تأثير | |

**لا يتم إضافة أي Document أو Field جديد إلى Firestore.** Firebase Auth مستقل تماماً.

---

## 3. Cloud Functions الجديدة

### 3.1 `provisionMerchantAuth(merchantId, phone, email?)` — HTTP Callable

**الغرض**: إنشاء حساب Firebase Auth لتاجر + تعيين Custom Claims.  
**المدخلات**: `merchantId`, `phone` (مطلوب), `email` (اختياري إن وجد).  
**المخرجات**: `{ uid, merchantId, role: "merchant" }`.  

**منطق العمل:**
1. التحقق من أن `merchantId` موجود في Firestore
2. التحقق من عدم وجود Firebase Auth user مسبقاً لهذا التاجر
3. إنشاء Firebase Auth user باستخدام `email` (إن وجد) أو بدون email (فقط phone + password)
4. تعيين Custom Claim: `{ role: "merchant", merchantId: "xxx" }`
5. إعادة `{ uid, merchantId }`
6. إذا فشلت أي خطوة → لا تأثير على Firestore

**Idempotent**: يمكن إعادة تشغيلها، تكتشف الـ UID الموجود وتعيده.

### 3.2 `provisionAdminAuth(email, password)` — HTTP Callable

**الغرض**: إنشاء حساب Firebase Auth للمسؤول.  
**المدخلات**: `email` (حقيقي), `password`.  
**المخرجات**: `{ uid, role: "admin" }`.  
**منطق العمل**: مشابه، لكن مع `role: "admin"`.

### 3.3 `migrateAllMerchants()` — HTTP Callable (يُشغل يدوياً)

**الغرض**: ترحيل جميع التجار الحاليين دفعة واحدة.  
**منطق العمل:**
1. قراءة جميع `merchants` حيث `firebaseUid` غير موجود
2. لكل تاجر: استدعاء `provisionMerchantAuth(merchantId, phone, email)`
3. تسجيل النتائج في Firestore (نجاح/فشل لكل تاجر)
4. إعادة تقرير كامل

### 3.4 `checkMigrationStatus()` — HTTP Callable (قراءة فقط)

**الغرض**: معرفة عدد التجار المهاجرين والمتبقين.

---

## 4. Firebase Services المستخدمة

| الخدمة | الهدف | حالة الاستخدام |
|--------|-------|---------------|
| `firebase-auth` | المصادقة | Email/Password للمسؤول، Phone أو Email/Password للتجار |
| `firebase-auth` | Custom Claims | `admin.auth().setCustomUserClaims(uid, { role, merchantId })` |
| `firebase-functions` | Provisioning | دوال HTTP Callable للإنشاء والترحيل |
| `firebase-firestore` | تخزين البيانات | بدون تغيير (مستمر كما هو) |
| `firestore.rules` | الأمان | فقط بعد اكتمال Auth |

**ملاحظة**: Phone Authentication في Firebase لا يتطلب أرقام وهمية — يستخدم OTP عبر SMS حقيقياً. لكنه يتطلب:
- تفعيل Phone Auth في Firebase Console
- الخطة التسعيرية (Spark مجاني، Blaze مدفوع)
- للـ Admin: Email/Password (حقيقي)
- للتاجر: Email/Password (باستخدام البريد إن وجد) مع التحضير لـ Phone مستقبلاً

---

## 5. خطة الترحيل بالترتيب (6 مراحل)

### المرحلة 0: إعداد Firebase Console

| الخطوة | الإجراء | التحقق |
|--------|---------|--------|
| 0.1 | تفعيل Email/Password Authentication في Firebase Console | ✅ |
| 0.2 | تفعيل Phone Authentication في Firebase Console (اختياري) | ✅ |
| 0.3 | إضافة `firebase-auth-compat.js` إلى `admin/index.html` | ✅ Script محمل |
| 0.4 | نشر دوال Cloud Functions الجديدة | ✅ `firebase deploy --only functions` |

**التأثير على المستخدمين الحاليين**: لا يوجد. النظام القديم مستمر.

---

### المرحلة 1: Admin Panel — Firebase Auth (مع الاحتفاظ بالقديم)

| الخطوة | الإجراء | ملف |
|--------|---------|-----|
| 1.1 | إضافة `onAuthStateChanged` في `app.js` — يستمع لحالة Firebase Auth | `app.js` |
| 1.2 | تعديل `handleLogin()` — محاولة Firebase Auth أولاً، فإن فشلت → Custom Auth القديم | `app.js` |
| 1.3 | إضافة زر "تسجيل الدخول بحساب Firebase" في الـ Login Overlay (بجانب القديم) | `index.html` |
| 1.4 | إضافة `provisionAdminAuth(email, password)` — إنشاء أول Admin | `functions/` |
| 1.5 | اختبار: تسجيل الدخول بـ Firebase Auth → Custom Claim "admin" → وصول كامل | ✅ يدوي |

**التأثير**: Admin Panel يدعم نظامي تسجيل دخول بالتوازي. القديم لم يُمس.  
**اختبار المرحلة**: Admin قادر على تسجيل الدخول بالنظام الجديد والقديم.  
**Rollback لهذه المرحلة**: تعطيل الاستماع لـ `onAuthStateChanged` — دقيقة واحدة.

---

### المرحلة 2: Merchant App — إضافة Firebase Auth (مع الاحتفاظ بالقديم)

| الخطوة | الإجراء | ملف |
|--------|---------|-----|
| 2.1 | إضافة زر "تسجيل الدخول بـ Firebase" في شاشة الدخول (بجانب القديم) | merchant app |
| 2.2 | إضافة `signInWithFirebaseAuth()` — تسجيل الدخول عبر Firebase Auth | `authFirebase.ts` |
| 2.3 | تعديل `merchantContext` — قبول token من Firebase Auth أو Custom Auth | `merchantContext.tsx` |
| 2.4 | اختبار: تاجر مسجل في Firebase Auth → Custom Claim "merchant" + merchantId → وصول لبياناته فقط | ✅ يدوي |

**التأثير**: Merchant App يدعم نظامي تسجيل دخول بالتوازي. القديم لم يُمس.  
**اختبار المرحلة**: تاجر قادر على تسجيل الدخول بالنظام الجديد والقديم.  
**Rollback لهذه المرحلة**: إزالة زر Firebase Auth من واجهة الدخول — دقيقة واحدة.

---

### المرحلة 3: Provisioning — ربط التجار الجدد بـ Firebase Auth

| الخطوة | الإجراء | ملف |
|--------|---------|-----|
| 3.1 | إنشاء `provisionMerchantAuth` في `functions/` | `functions/provisionAuth.js` |
| 3.2 | إضافة زر "تفعيل Firebase Auth" في صفحة تعديل التاجر في Admin Panel | `merchants.js` |
| 3.3 | الزر يستدعي `provisionMerchantAuth` (وليس `saveMerchant()`) | (يدوي — لا تلقائي) |
| 3.4 | اختبار: إنشاء تاجر جديد → تفعيل Firebase Auth يدوياً → تاجر يسجل دخول | ✅ يدوي |

**التأثير**: لا تأثير على التجار الحاليين. فقط التجار الجدد أو من يتم تفعيلهم يدوياً.  
**اختبار المرحلة**: إنشاء تاجر → تفعيل Auth → تسجيل دخول ناجح.  
**Rollback لهذه المرحلة**: عدم استخدام زر "تفعيل" — لا تأثير.

---

### المرحلة 4: الترحيل الشامل (اختياري — يُشغل يدوياً)

| الخطوة | الإجراء |
|--------|---------|
| 4.1 | تشغيل `migrateAllMerchants()` من Firebase Console أو Admin Panel |
| 4.2 | مراجعة التقرير (نجاح/فشل لكل تاجر) |
| 4.3 | إعادة تشغيل الـ Migration للفاشلين |
| 4.4 | إرسال إشعارات للتجار بوجود نظام دخول جديد (اختياري) |

**التأثير**: جميع التجار لديهم Firebase Auth accounts. النظام القديم لا يزال فعالاً.  
**اختبار المرحلة**: عينة من التجار يسجلون دخول بالنظام الجديد.  
**Rollback لهذه المرحلة**: لا حاجة — النظام القديم لا يزال فعالاً.

---

### المرحلة 5: تعطيل النظام القديم (بعد 30 يوماً من الترحيل)

| الخطوة | الإجراء | ملف |
|--------|---------|-----|
| 5.1 | تعطيل Custom Auth في Admin Panel | `app.js` |
| 5.2 | تعطيل Custom Auth في Merchant App | `authFirebase.ts` |
| 5.3 | حذف `settings/admin_credentials` (اختياري) | — |
| 5.4 | حذف `merchant_admin/credentials` (اختياري) | — |

**التأثير**: Firebase Auth هو النظام الوحيد.  
**Rollback لهذه المرحلة**: إعادة تفعيل Custom Auth (الكود لا يُحذف، يُعلّق فقط) — 5 دقائق.

---

### المرحلة 6: نشر Security Rules

| الخطوة | الإجراء | ملف |
|--------|---------|-----|
| 6.1 | كتابة `firestore.rules` مع `request.auth` و `token.role` | `firestore.rules` |
| 6.2 | اختبار القواعد في Firebase Console > Rules Playground | ✅ |
| 6.3 | اختبار Admin: هل يستطيع قراءة/كتابة جميع Collections | ✅ يدوي |
| 6.4 | اختبار Merchant: هل يقرأ بياناته فقط؟ هل يمنع من الكتابة؟ | ✅ يدوي |
| 6.5 | اختبار مستخدم غير مسجل: هل يُمنع من كل شيء؟ | ✅ يدوي |
| 6.6 | نشر القواعد: `firebase deploy --only firestore:rules` | ✅ |
| 6.7 | إضافة `firestore` إلى `firebase.json` | ✅ |

**اختبار ما بعد النشر:**
- [ ] Admin Panel: جميع العمليات تعمل (CRUD للتجار، العهدة، الحسابات، التركيبات، التقارير)
- [ ] Merchant App: التاجر يقرأ بياناته فقط
- [ ] Merchant App: محاولة كتابة تمنع (403)
- [ ] مستخدم غير مسجل: ممنوع من القراءة والكتابة
- [ ] الـ 5 composite indexes تعمل (الاستعلامات لا تطلب indexes جديدة)

**Rollback لهذه المرحلة:**
```
firebase deploy --only firestore:rules --dry-run  # التأكد من القواعد القديمة
# أو: حذف القواعد يدوياً من Firebase Console
```

---

## 6. خطة Rollback الشاملة

| السيناريو | الإجراء | الوقت المقدر |
|-----------|---------|-------------|
| فشل في Admin Login (جديد) | التبديل لـ Custom Auth القديم — دقيقة واحدة | < 1 دقيقة |
| فشل في Merchant Login (جديد) | التبديل لـ Custom Auth القديم — دقيقة واحدة | < 1 دقيقة |
| Firebase Service متعطل | Custom Auth القديم يعمل كـ Fallback تلقائي | 0 — تلقائي |
| فشل Provisioning | لا تأثير — التاجر بلا Firebase Auth فقط، يكمل بـ Custom Auth | 0 |
| فشل Migration | التجار الفاشلون لم يُنشأ لهم Firebase Auth — يكملون بـ Custom | 0 |
| خطأ في Security Rules | إزالة القواعد من Firebase Console — دقيقة واحدة | < 1 دقيقة |
| كارثة | إلغاء نشر آخر Deploy: `firebase deploy --only firestore:rules` | 2 دقيقة |

**المبدأ الأساسي**: النظام القديم لا يُحذف حتى تمر 30 يوماً من التشغيل المستقر على Firebase Auth.

---

## 7. آلية Provisioning — خدمة مستقلة

```
                 +------------------+
                 |  Admin Panel     |
                 |  (زر "تفعيل")    |
                 +--------+---------+
                          |
                          | استدعاء HTTP Callable
                          v
                 +------------------+
                 |  Cloud Function  |
                 | provisionAuth    |
                 +--------+---------+
                          |
              +-----------+-----------+
              |                       |
              v                       v
     +------------------+   +------------------+
     | Firebase Auth    |   | (لا شيء في      |
     | .createUser()    |   |  Firestore)      |
     | .setCustomClaims()|  |                  |
     +------------------+   +------------------+
              |
              v
     { uid, merchantId, role: "merchant" }
```

**لماذا مستقلة عن `saveMerchant()`:**
- `saveMerchant()` تنشئ Document في Firestore فقط
- الـ Provisioning تُستدعى بشكل منفصل (يدوي أو عبر Queue)
- إذا فشلت، يُعاد تشغيلها دون فقدان بيانات التاجر
- Idempotent: تكتشف الـ UID الموجود ولا تُنشئ duplicate

**خطوات التفعيل من Admin Panel:**
1. افتح صفحة تعديل التاجر
2. زر جديد: "🔐 تفعيل Firebase Auth"
3. الضغط يستدعي `provisionMerchantAuth(merchantId, phone, email)`
4. تظهر رسالة نجاح/فشل
5. بعد النجاح، التاجر يسجل دخول بـ (phone + password)

---

## 8. ماذا عن Phone Authentication؟

**حالياً**: Email/Password Authentication (للمسؤول: email حقيقي، للتاجر: phone + password).
**مستقبلاً**: يمكن إضافة Phone Authentication (OTP عبر SMS).

**لماذا لا نستخدم Phone Authentication من البداية؟**

| Phone Auth | Email/Password |
|------------|----------------|
| يتطلب SMS (تكلفة) | مجاني |
| لا يعمل في بيئة التطوير بدون محاكاة | يعمل في أي بيئة |
| OTP يصل خلال ثوانٍ | Password ثابت |
| لا يمكن استخدامه لـ Custom Claims بسهولة | Custom Claims فوري |

**خطة الترقية لـ Phone Auth:**
```
المرحلة الحالية:  Email/Password (phone + password)  ← نحن هنا
     ↓
المرحلة القادمة:  Email/Password + Phone (اختياري)
     ↓
المستقبل:         Phone Auth (OTP) أساسي، Email/Password Fallback
```

عند الترقية، لا نحتاج لتغيير الـ Custom Claims أو Security Rules — فقط طريقة `signIn`.

---

## 9. قائمة الاختبارات النهائية (قبل نشر Security Rules)

### 9.1 Admin Panel — جميع العمليات تعمل

- [ ] تسجيل الدخول بـ Firebase Auth (admin@...)
- [ ] رفض دخول مستخدم بدون role
- [ ] إنشاء تاجر
- [ ] تعديل تاجر
- [ ] إضافة عهدة
- [ ] حساب كروت (مع خصم المخزون)
- [ ] إضافة تركيب
- [ ] كشف حساب / طباعة
- [ ] إدارة أسعار الكروت
- [ ] أرشفة تاجر
- [ ] سجل التدقيق

### 9.2 Merchant App — التاجر يقرأ بياناته فقط

- [ ] تسجيل الدخول بـ Firebase Auth (phone + password)
- [ ] رفض دخول تاجر إلى تاجر آخر
- [ ] قراءة بياناته الشخصية
- [ ] قراءة العهدة الخاصة به
- [ ] قراءة معاملاته
- [ ] قراءة تركيباته
- [ ] قراءة الإشعارات الخاصة به

### 9.3 Security Rules — الصلاحيات

- [ ] Admin: قراءة/كتابة جميع Collections
- [ ] Merchant: قراءة `merchants/{merchantId}` الخاص به فقط
- [ ] Merchant: قراءة `merchant_inventory/{merchantId}` الخاص به فقط
- [ ] Merchant: قراءة `merchant_transactions/{merchantId}` الخاص به فقط
- [ ] Merchant: قراءة `merchant_installations` التي تخصه فقط
- [ ] Merchant: قراءة `merchant_notifications` التي تخصه فقط
- [ ] Merchant: **ممنوع** من كتابة أي شيء
- [ ] Merchant: **ممنوع** من قراءة `merchant_audit_logs`
- [ ] Merchant: **ممنوع** من قراءة `merchant_card_prices` (للقراءة فقط من Admin — أو يمكن السماح)
- [ ] غير مسجل: **ممنوع** من كل شيء

### 9.4 التطبيق الحالي — لم يتأثر

- [ ] Hotspot
- [ ] QR
- [ ] Notifications (الحالية)
- [ ] Customers
- [ ] Sale Regions
- [ ] Categories
- [ ] Global Buttons
- [ ] Settings
- [ ] Updates

---

## 10. ملخص المخرجات النهائية (بعد اكتمال الترحيل)

| المكوّن | الحالة |
|---------|--------|
| `admin/index.html` | + script firebase-auth-compat.js |
| `admin/app.js` | + handleLogin() جديد مع Fallback |
| `admin/modules/merchants.js` | + زر "تفعيل Firebase Auth" |
| `modules/merchant/authFirebase.ts` | + signInWithFirebaseAuth() |
| `functions/provisionAuth.js` | **جديد** |
| `functions/migrateMerchants.js` | **جديد** |
| `firestore.rules` | **جديد** — يُنشر فقط بعد الاختبار |
| `firestore.indexes.json` | **جديد** — يُنشر فقط بعد الاختبار |
| `firebase.json` | + firestore config |
| Custom Auth القديم | موجود كـ Fallback — يُزال بعد 30 يوماً |

---

**جاهز للبدء.** انتظار الموافقة على الـ Checklist قبل أي تنفيذ.
