# Phase 2.5 — Integration Testing

> **بيئة اختبار معزولة — بيانات تجريبية فقط**  
> لا تُستخدم أي بيانات حقيقية.  
> بعد نجاح جميع الاختبارات، يُسمح بالانتقال لـ Phase 3 (Migration).

---

## 1. إعداد بيئة الاختبار

### 1.1 المتطلبات الأساسية

| المكوّن | الحالة | ملاحظات |
|---------|--------|---------|
| Firebase Authentication | ❌ غير مفعل | يحتاج تفعيل يدوي من Firebase Console |
| Cloud Functions | ❌ غير منشورة | يحتاج Blaze plan |
| Admin Panel | ✅ متاح على localhost | يعمل بـ Legacy حالياً |
| Merchant App | ✅ يعمل (Expo/React Native) | يعمل بـ Legacy حالياً |

### 1.2 بيانات الاختبار التجريبية

تُنشأ في Firestore تحت Collection منفصلة (`test_merchants`) حتى لا تتداخل مع البيانات الحقيقية.

#### Users التجريبية

| # | المعرف | النظام | الحالة | الباسورد | ملاحظات |
|---|--------|--------|--------|----------|---------|
| A1 | `test_admin_legacy` | Legacy | مفعل | `test123` | Admin قديم فقط |
| A2 | `test_admin_firebase` | Firebase | مفعل | `firePass1` | Admin مع Firebase Auth |
| M1 | `test_merchant_legacy` | Legacy | مفعل | `merchLeg1` | تاجر قديم فقط |
| M2 | `test_merchant_firebase` | Firebase | مفعل | `merchFire1` | تاجر مع Firebase Auth |
| M3 | `test_merchant_needs_sync` | Firebase | 🟡 يحتاج مزامنة | `syncMe123` | Firebase Auth موجود لكن Claims غير صحيحة |
| M4 | `test_merchant_archived` | Legacy | مؤرشف | `archived1` | تاجر مؤرشف — ممنوع من الدخول |
| X1 | `test_wrong_creds` | — | — | أي كلمة | بيانات دخول خاطئة |

---

## 2. 20 سيناريو اختبار

### 🧪 S01 — Admin Legacy فقط

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن Admin الذي ليس لديه Firebase Auth يدخل عبر Legacy |
| **المستخدم** | `test_admin_legacy` / `test123` |
| **حالة الحساب** | `admin_credentials.firebaseEmail` غير موجود |
| **خطوات التنفيذ** | 1. فتح Admin Panel 2. إدخال `test_admin_legacy` + `test123` 3. ضغط "دخول" |
| **التوقع** | ✅ دخول ناجح — `auth_source` = `legacy` |
| **النتيجة الفعلية** | ⬜ |
| **Logs** | `[Auth] No Firebase email — using Legacy` → `[Auth] Legacy Auth success` |
| **نجح؟** | ⬜ |

### 🧪 S02 — Admin Firebase فقط

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن Admin الذي لديه Firebase يدخل عبر Firebase Auth |
| **المستخدم** | `test_admin_firebase` / `firePass1` |
| **حالة الحساب** | `admin_credentials.firebaseEmail = "admin@test.local"` و Firebase Auth user موجود |
| **خطوات التنفيذ** | 1. فتح Admin Panel 2. إدخال `test_admin_firebase` + `firePass1` 3. ضغط "دخول" |
| **التوقع** | ✅ دخول ناجح عبر Firebase — `auth_source` = `firebase` |
| **النتيجة الفعلية** | ⬜ |
| **Logs** | `[Auth] Attempting Firebase Auth` → `[Auth] Firebase Auth success` |
| **نجح؟** | ⬜ |

### 🧪 S03 — Merchant Legacy فقط

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن تاجر بدون Firebase يدخل عبر Legacy |
| **المستخدم** | `test_merchant_legacy` / `merchLeg1` |
| **حالة الحساب** | `firebaseAuthUid` غير موجود في مستند التاجر |
| **خطوات التنفيذ** | 1. فتح Merchant App 2. إدخال `test_merchant_legacy` + `merchLeg1` 3. ضغط "تسجيل الدخول" |
| **التوقع** | ✅ دخول ناجح — يتم تحميل بيانات التاجر عبر `fetchMerchantByUsername` |
| **النتيجة الفعلية** | ⬜ |
| **Logs** | `[MerchantAuth] Attempting Legacy Auth` → `[MerchantAuth] Legacy Auth success` |
| **نجح؟** | ⬜ |

### 🧪 S04 — Merchant Firebase فقط

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن تاجر مع Firebase يدخل عبر Firebase |
| **المستخدم** | `test_merchant_firebase` / `merchFire1` |
| **حالة الحساب** | `firebaseAuthUid` موجود + `email` موجود في مستند التاجر |
| **خطوات التنفيذ** | 1. فتح Merchant App 2. إدخال `test_merchant_firebase` + `merchFire1` 3. ضغط "تسجيل الدخول" |
| **التوقع** | ✅ دخول ناجح — يتم تحميل بيانات التاجر من Firestore عبر `merchantId` من Custom Claims (وليس username) |
| **النتيجة الفعلية** | ⬜ |
| **Logs** | `[MerchantAuth] Attempting Firebase Auth for` → `[MerchantAuth] Firebase Auth success` |
| **نجح؟** | ⬜ |

### 🧪 S05 — Merchant يحتاج مزامنة

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن 🟡 يحتاج مزامنة يُكتشف ويعرض في Admin Panel |
| **المستخدم** | `test_merchant_needs_sync` (عرض في Admin Panel فقط) |
| **حالة الحساب** | `firebaseAuthUid` موجود لكن Firebase Auth user محذوف أو Claims غير صحيحة |
| **خطوات التنفيذ** | 1. فتح Admin Panel 2. الدخول لتبويب "حسابات" 3. البحث عن `test_merchant_needs_sync` |
| **التوقع** | 🟡 يحتاج مزامنة يظهر في بطاقة التاجر. عند الضغط على "🔄 إعادة مزامنة" → يعمل `checkMerchantAuthStatus` |
| **النتيجة الفعلية** | ⬜ |
| **Logs** | `[checkMerchantAuthStatus] merchant → needs_sync` |
| **نجح؟** | ⬜ |

### 🧪 S06 — Merchant Archived

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن التاجر المؤرشف ممنوع من الدخول |
| **المستخدم** | `test_merchant_archived` / `archived1` |
| **حالة الحساب** | `status = "archived"` |
| **خطوات التنفيذ** | 1. فتح Merchant App 2. إدخال `test_merchant_archived` + `archived1` 3. ضغط "تسجيل الدخول" |
| **التوقع** | ❌ رفض الدخول — `verifyMerchantCredentials` ترجع `null` → رسالة "اسم المستخدم أو كلمة المرور غير صحيحة" |
| **النتيجة الفعلية** | ⬜ |
| **Logs** | `merchant.status !== "active"` → return null |
| **نجح؟** | ⬜ |

### 🧪 S07 — بيانات دخول خاطئة (Username غير موجود)

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن الـ Username غير الموجود يمنع الدخول |
| **المستخدم** | `ghost_user` / `anyPass123` |
| **حالة الحساب** | غير موجود نهائياً في Firestore |
| **خطوات التنفيذ** | 1. فتح Admin Panel 2. إدخال `ghost_user` + `anyPass123` 3. ضغط "دخول" |
| **التوقع** | ❌ رسالة "اسم المستخدم أو كلمة المرور غير صحيحة" |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S08 — كلمة مرور خاطئة

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن كلمة المرور الخاطئة تمنع الدخول |
| **المستخدم** | `test_merchant_legacy` / `wrongPass999` |
| **خطوات التنفيذ** | 1. فتح Merchant App 2. إدخال `test_merchant_legacy` + `wrongPass999` 3. ضغط "تسجيل الدخول" |
| **التوقع** | ❌ رسالة "اسم المستخدم أو كلمة المرور غير صحيحة" |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S09 — Firebase غير متاح

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن Firebase Auth معطل لا يمنع الدخول — Legacy يعمل |
| **السيناريو** | Firebase Auth Service معطل (يمكن محاكاته بـ تعطيل Firebase Console أو قطع API) |
| **المستخدم** | `test_admin_firebase` / `firePass1` — لكن Firebase معطل |
| **خطوات التنفيذ** | 1. تعطيل Firebase Auth مؤقتاً 2. فتح Admin Panel 3. إدخال الـ username + password 4. ضغط "دخول" |
| **التوقع** | ✅ `signInWithEmailAndPassword` يرمي `auth/internal-error` → رسالة خطأ (حسب الكود — حالياً FATAL_ERROR_CODES لا تشمل internal-error → يظهر "اسم المستخدم أو كلمة المرور غير صحيحة") |
| **ملاحظة** | **هذا السيناريو يحتاج تعديل في الكود**: `auth/internal-error` يجب أن يكون في FATAL_ERROR_CODES أو يسمح بـ Legacy Fallback. حالياً الكود لا يتعامل مع `internal-error` — يقع في `else` branch → `fatalError = "اسم المستخدم أو كلمة المرور غير صحيحة"`. هذا خطأ — يجب السماح بـ Legacy Fallback. |
| **التعديل المطلوب** | إضافة `auth/internal-error` إلى FALLBACK_ERRORS (لأن Firebase معطل وليس خطأ في بيانات المستخدم) |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S10 — Firestore غير متاح

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن Firestore معطل لا يمنع Firebase Auth |
| **السيناريو** | Firestore غير متاح لكن Firebase Auth يعمل |
| **المستخدم** | `test_merchant_firebase` / `merchFire1` |
| **خطوات التنفيذ** | 1. فصل Firestore 2. فتح Merchant App 3. إدخال `test_merchant_firebase` + `merchFire1` 4. ضغط "تسجيل الدخول" |
| **التوقع** | ❌ Firebase Auth قد ينجح (لأنه خدمة منفصلة) لكن تحميل بيانات التاجر من Firestore يفشل → رسالة "حدث خطأ في تسجيل الدخول" |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S11 — انقطاع الإنترنت

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن انقطاع الإنترنت يعرض رسالة مناسبة ولا يحاول Legacy |
| **السيناريو** |切断 الإنترنت قبل تسجيل الدخول |
| **المستخدم** | أي |
| **خطوات التنفيذ** | 1. قطع الإنترنت 2. فتح Merchant App 3. إدخال أي بيانات 4. ضغط "تسجيل الدخول" |
| **التوقع** | ❌ Firebase يرمي `auth/network-request-failed` → رسالة "خطأ في الاتصال بالإنترنت. تأكد من اتصالك وحاول مرة أخرى." |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S12 — Firebase Token منتهي

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن Firebase token منتهي لا يسبب مشكلة — يعيد تسجيل الدخول |
| **السيناريو** | تسجيل الدخول بـ Firebase → انتظار انتهاء الـ token (عادة 1 ساعة) → إعادة تحميل الصفحة |
| **خطوات التنفيذ** | 1. تسجيل الدخول بـ Firebase 2. `localStorage("admin_auth")` = true 3. انتظار انتهاء الـ token 4. إعادة تحميل Admin Panel |
| **التوقع** | ✅ `checkAuth()` يقرأ `localStorage` → يظهر الـ Dashboard. `onAuthStateChanged` يطلق `null` → لا تأثير. عند أي طلب Firestore → خطأ → يعاد تسجيل الدخول. |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S13 — Custom Claims غير موجودة

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أنه إذا Firebase user ليس Admin → يرفض الدخول |
| **السيناريو** | Firebase Auth user موجود لكن بدون Custom Claims (أو role غير admin) |
| **المستخدم** | `test_merchant_firebase` في Admin Panel |
| **خطوات التنفيذ** | 1. استخدام بيانات Firebase لتاجر (وليس Admin) في Admin Panel 2. ضغط "دخول" |
| **التوقع** | ❌ `signInWithEmailAndPassword` ينجح لكن `claims.role !== "admin"` → `signOut` + رسالة "اسم المستخدم أو كلمة المرور غير صحيحة" |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S14 — MerchantId غير صحيح داخل Claims

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن بيانات Merchants تُحمَل من Firestore عبر `merchantId` في Claims (وليس username) |
| **السيناريو** | `merchantId` في Claims يشير إلى مستند Firestore غير موجود |
| **التوقع** | ❌ `fetchMerchantById(fbMerchantId)` يرجع `null` → `signInWithEmailAndPassword` ينجح لكن التاجر لا يوجد → رسالة خطأ |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S15 — محاولة تفعيل تاجر مفعل مسبقاً

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن زر التفعيل معطل (disabled) للتاجر 🟢 مفعل |
| **المستخدم** | تاجر لديه `firebaseAuthUid` و `firebaseAuthStatus = "active"` |
| **خطوات التنفيذ** | 1. فتح Admin Panel 2. الذهاب لملف تاجر 🟢 3. مراجعة الأزرار |
| **التوقع** | ✅ الزر معطل — يظهر "🟢 Firebase مفعل" بدلاً من "🔐 تفعيل" |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S16 — محاولة Provision مرتين

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن `provisionMerchantAuth` Idempotent — لا يُنشئ duplicate |
| **المستخدم** | تاجر غير مفعل |
| **خطوات التنفيذ** | 1. الضغط على "🔐 تفعيل" 2. الانتظار للنجاح 3. الضغط مرة أخرى (أو إعادة الاتصال) |
| **التوقع** | ✅ المرة الأولى: إنشاء مستخدم + كتابة `firebaseAuthUid`. المرة الثانية: `findMerchantAuthUser` يكتشف الـ user الموجود → يرجع `alreadyExisted: true` + تحديث `firebaseAuthUpdatedAt` |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S17 — Logout

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن Logout يمسح كل شيء ويعود لشاشة الدخول |
| **السيناريو** | Admin أو Merchant مسجل الدخول |
| **خطوات التنفيذ** | 1. تسجيل الدخول 2. ضغط "تسجيل الخروج" 3. فحص الحالة |
| **التوقع** | ✅ Admin: `localStorage("admin_auth")` = null, `localStorage("auth_source")` = null, Firebase `signOut`. Merchant: `session` = null, Firebase `signOut`. كلاهما: شاشة الدخول تظهر. |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S18 — Login بعد Restart

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن إعادة تشغيل التطبيق يتطلب إعادة تسجيل دخول (حالياً) |
| **السيناريو** | تسجيل دخول → إغلاق التطبيق → فتحه مرة أخرى |
| **التوقع** | ✅ حاجة إلى إعادة تسجيل دخول لأن `loadSession()` يرجع `null` (مؤقتاً). مستقبلاً: persistence. |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S19 — Login بدون Cache

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن مسح الكاش لا يؤثر على تسجيل الدخول |
| **السيناريو** | مسح localStorage/AsyncStorage → إعادة تسجيل دخول |
| **التوقع** | ✅ نفس تجربة تسجيل الدخول الأولى — لا Cache dependency |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

### 🧪 S20 — Login مع Session موجودة

| الحقل | القيمة |
|-------|--------|
| **الهدف** | التأكد أن الصفحة لا تظهر Login إذا كانت Session صالحة |
| **السيناريو** | Session صالحة (localStorage + Firebase token) |
| **خطوات التنفيذ** | 1. تسجيل الدخول 2. إعادة تحميل الصفحة (F5) |
| **التوقع** | ✅ Admin: `checkAuth()` يرجع `true` → Dashboard يظهر مباشرة (لا Login). Merchant: session موجود في React state → Dashboard يظهر. |
| **النتيجة الفعلية** | ⬜ |
| **نجح؟** | ⬜ |

---

## 3. المقاييس (Metrics)

### 3.1 Admin Panel — Login

| المقياس | Legacy | Firebase |
|---------|--------|----------|
| Firestore Reads | 1 (`settings/admin_credentials`) | 1 (نفس + Firebase Auth) |
| Firestore Writes | 1 (`lastLoginAt`) | 1 (نفس) |
| Firebase Auth Calls | 0 | 2 (`signIn` + `getIdTokenResult`) |
| زمن تسجيل الدخول | ~200-500ms | ~300-800ms |
| عدد الاستعلامات | 1-2 | 2-3 |

### 3.2 Merchant App — Login

| المقياس | Legacy | Firebase |
|---------|--------|----------|
| Firestore Reads | 1 (`merchants` where `username == X`) | 1-2 (أولاً username ثم `merchantId`) |
| Firestore Writes | 0 | 0 |
| Firebase Auth Calls | 0 | 2 (`signIn` + `getIdTokenResult`) |
| زمن تسجيل الدخول | ~200-500ms | ~400-900ms |
| عدد الاستعلامات | 1 | 2-3 |

### 3.3 Provisioning

| المقياس | القيمة |
|---------|--------|
| Firebase Auth Calls | 2 (`createUser` + `setCustomUserClaims`) |
| Firestore Reads | 1 (تحقق من وجود التاجر) |
| Firestore Writes | 1 (`firebaseAuthUid`, `firebaseAuthStatus`, `firebaseAuthActivatedAt`) |
| زمن Provisioning | ~500-1500ms |
| Idempotent Check | 1 (`getUsers` by custom claim) |

### 3.4 Admin Panel — Merchant List

| المقياس | القيمة |
|---------|--------|
| Firestore Reads | 1 (query `merchants`) |
| Firestore Writes | 0 |
| Firebase Auth Calls | 0 (الـ status يُقرأ من `firebaseAuthStatus` المخزّن في Firestore) |
| زمن التحميل | ~200-400ms |
| عدد الاستعلامات | 1 |

---

## 4. النتائج — ملخص

| # | السيناريو | النتيجة | ملاحظات |
|---|-----------|---------|---------|
| S01 | Admin Legacy فقط | ⬜ | |
| S02 | Admin Firebase فقط | ⬜ | يتطلب تفعيل Firebase Auth |
| S03 | Merchant Legacy فقط | ⬜ | |
| S04 | Merchant Firebase فقط | ⬜ | يتطلب تفعيل Firebase Auth + إنشاء test user |
| S05 | Merchant يحتاج مزامنة | ⬜ | يتطلب إنشاء حالة اختبار 🟡 |
| S06 | Merchant Archived | ⬜ | |
| S07 | بيانات دخول خاطئة | ⬜ | |
| S08 | كلمة مرور خاطئة | ⬜ | |
| S09 | Firebase غير متاح | ⬜ | يحتاج تعديل: `auth/internal-error` → Legacy Fallback |
| S10 | Firestore غير متاح | ⬜ | |
| S11 | انقطاع الإنترنت | ⬜ | |
| S12 | Firebase Token منتهي | ⬜ | |
| S13 | Custom Claims غير موجودة | ⬜ | يتطلب Firebase |
| S14 | MerchantId غير صحيح | ⬜ | يتطلب Firebase |
| S15 | تفعيل تاجر مفعل مسبقاً | ⬜ | |
| S16 | Provision مرتين | ⬜ | Idempotent check |
| S17 | Logout | ⬜ | |
| S18 | Login بعد Restart | ⬜ | |
| S19 | Login بدون Cache | ⬜ | |
| S20 | Login مع Session موجودة | ⬜ | |

---

## 5. الاختبارات التي تحتاج Firebase Auth مفعّل

قبل تشغيل هذه الاختبارات، يجب:
1. الذهاب إلى [Firebase Console > Authentication > Sign-in method](https://console.firebase.google.com/project/samara-560ad/authentication)
2. تفعيل **Email/Password**
3. إنشاء مستخدمين اختبار:
   - `admin@test.local` / `testPass123` مع Custom Claim `{ role: "admin" }`
   - `merchant_m2@test.local` / `testPassMerch` مع Custom Claim `{ role: "merchant", merchantId: "test_M2_id" }`
4. تحديث `admin_credentials.firebaseEmail` → `admin@test.local`
5. تحديث `test_merchant_firebase.email` → `merchant_m2@test.local`

### الاختبارات المتوقفة على Firebase Auth

| السيناريو | البديل بدون Firebase |
|-----------|---------------------|
| S02 | مؤقت — يستخدم Legacy |
| S04 | مؤقت — يستخدم Legacy |
| S05 | يمكن اختبار 🟡 يدوياً عبر كتابة `firebaseAuthUid` في Firestore مباشرة |
| S09 | يحاكى بتعطيل Firebase SDK مؤقتاً |
| S12 | يحاكى بتغيير ساعة الجهاز أو انتظار ساعة |
| S13, S14 | مؤقت — لا يمكن بدون Firebase |

---

## 6. خطة التنفيذ

### المرحلة 2.5-A — إعداد بيانات الاختبار

- [x] إنشاء وثيقة الاختبارات
- [ ] إنشاء مستندات `test_merchants` في Firestore
- [ ] تعبئة `admin_credentials` للمستخدمين الاختباريين
- [ ] إنشاء Cloud Function test helper إذا لزم

### المرحلة 2.5-B — اختبارات Legacy

- [ ] تشغيل S01, S03, S06, S07, S08, S15, S16, S17, S18, S19, S20
- [ ] كلها تعمل بدون Firebase Auth
- [ ] تسجيل النتائج

### المرحلة 2.5-C — تفعيل Firebase Auth

- [ ] تفعيل Email/Password في Firebase Console
- [ ] ترقية إلى Blaze plan (لـ Cloud Functions)
- [ ] نشر Cloud Functions
- [ ] إنشاء مستخدمين اختبار

### المرحلة 2.5-D — اختبارات Firebase

- [ ] تشغيل S02, S04, S05, S09, S10, S11, S12, S13, S14
- [ ] تسجيل النتائج
- [ ] إصلاح أي أخطاء مكتشفة

---

## 7. التعديلات المطبقة (تم الإصلاح أثناء التخطيط)

| # | المشكلة | الملف | الإصلاح | الحالة |
|---|---------|-------|---------|--------|
| 1 | `auth/internal-error` لا يؤدي لـ Legacy Fallback | `admin/app.js` | ✅ إضافة `"auth/internal-error"` إلى `FALLBACK_ERRORS` | ✅ تم |
| 2 | `auth/internal-error` ليس في FATAL_ERROR_CODES ولا في FALLBACK_ERRORS | `authFirebase.ts` | ✅ إضافة `"auth/internal-error"` إلى `FALLBACK_ERRORS` | ✅ تم |
| 3 | Session persistence لا يعمل (يعيد null دائماً) | `useMerchantAuth.ts` | متعمد — يحتاج تفعيل persistence مستقبلاً | ⏳ مؤجل |
| 4 | Test data not seeded | — | تم إنشاء `seed_test_data.js` + `test_data.json` للاستيراد اليدوي | ✅ تم |

## 8. نتائج Unit Tests (بدون Firebase)

تم تشغيل **47 اختبار وحدة** في `admin/scripts/unit_test_auth.js`:

| الفئة | النجاح | الفشل |
|-------|--------|-------|
| Password Hashing (6) | 6 ✅ | 0 ❌ |
| Fallback Decision (16) | 16 ✅ | 0 ❌ |
| Error Messages (4) | 4 ✅ | 0 ❌ |
| Merchant Credential Logic (4) | 4 ✅ | 0 ❌ |
| Session Creation (4) | 4 ✅ | 0 ❌ |
| Provisioning Idempotency (6) | 6 ✅ | 0 ❌ |
| Token Claim Validation (7) | 7 ✅ | 0 ❌ |
| **الإجمالي** | **47 ✅** | **0 ❌** |
