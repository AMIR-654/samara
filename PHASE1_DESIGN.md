# Phase 1 — Firebase Auth في Admin Panel (بالخلفية)

> تمت الموافقة على التصميم؟ ✅ / ❌
> **لا يبدأ التنفيذ إلا بعد الموافقة.**

---

## 1. شاشة تسجيل الدخول — بدون أي تغيير مرئي

```
┌─────────────────────┐
│  Samara             │
│  تسجيل الدخول       │
│                     │
│  [اسم المستخدم]     │
│  [كلمة المرور]      │
│                     │
│  [     دخول      ]  │  ← الزر نفسه، الكود تغير فقط
│                     │
└─────────────────────┘
```

### السلوك الجديد للـ `handleLogin()` (خلفية فقط):

```
ضغط "دخول"
    │
    ├── هل الحساب مربوط Firebase Email؟
    │   │
    │   نعم ← حاول Firebase Auth
    │   │   │
    │   │   ├── نجح ←    ✅ دخول
    │   │   └── فشل ←    ⬇️ انتقل لـ Legacy
    │   │
    │   لا ← ⬇️ انتقل لـ Legacy
    │
    └── Legacy Auth (القديم — Firestore)
        │
        ├── نجح ← ✅ دخول
        └── فشل ← ❌ "اسم المستخدم أو كلمة المرور غير صحيحة"
```

**المستخدم لا يرى فرقاً.** لا يوجد زر إضافي، لا رسالة منفصلة، لا تغيير في الـ UI.

### ربط Firebase Email بالحساب

يُخزّن في `settings/admin_credentials` حقل جديد:

| الحقل | القيمة |
|-------|--------|
| `firebaseEmail` | `"amir@example.com"` (بريد حقيقي) |

يُضبط هذا الحقل عبر `provisionAdminAuth(email, password)`.

---

## 2. قائمة التجار — إضافة "حالة Firebase"

### عمود جديد في جدول التجار

| اسم التاجر | الهاتف | الرصيد | حالة Firebase | إجراءات |
|-----------|--------|--------|---------------|---------|
| أحمد علي | 0100000000 | 500 | 🟢 مفعل | تعديل |
| محمد حسن | 0100000001 | 200 | 🔴 غير مفعل | تعديل • 🔐 تفعيل |

### الحالات الثلاث:

| الحالة | الشرط | المعنى |
|--------|-------|--------|
| 🔴 **غير مفعل** | `firebaseAuthUid` غير موجود | لم يُنشأ حساب Firebase Auth بعد |
| 🟢 **مفعل** | `firebaseAuthUid` موجود | الحساب منشأ وClaims مضبوطة |
| 🟡 **يحتاج مزامنة** | `firebaseAuthUid` موجود لكن حساب Firebase Auth محذوف أو تالف | يحتاج إعادة Provision |

### التحقق من 🟡 يحتاج مزامنة

عند تحميل قائمة التجار:
1. لكل تاجر لديه `firebaseAuthUid` → نحاول `auth.getUser(firebaseAuthUid)`
2. إذا نجح → 🟢 مفعل
3. إذا فشل (user not found) → 🟡 يحتاج مزامنة

**ملاحظة**: هذا الفحص يُجرى عبر Cloud Function (لأن `auth.getUser` يحتاج Admin SDK).

### آلية تخزين الحالة

بعد نجاح `provisionMerchantAuth`، يُحدّث مستند التاجر في Firestore بحقلين:
- `firebaseAuthUid: "..."` 
- `firebaseAuthUpdatedAt: Date.now()`
- `firebaseAuthStatus: "active"`

(الكتابة في Firestore تتم فقط بعد نجاح العملية بالكامل — متوافق مع الشرط.)

---

## 3. زر "🔐 تفعيل Firebase Authentication"

### الموقع
- داخل صفحة تعديل/عرض التاجر
- بجانب الأزرار الموجودة (تعديل، أرشفة)

### السلوك

| الحالة | الزر | القابلية |
|--------|------|----------|
| `firebaseAuthUid` غير موجود | 🔴 🔐 تفعيل Firebase Authentication | قابل للضغط |
| `firebaseAuthUid` موجود و🟢 | 🟢 ✅ Firebase Authentication مفعل | **معطل** |
| `firebaseAuthUid` موجود و🟡 | 🟡 🔄 إعادة مزامنة Firebase | قابل للضغط |
| جارٍ التفعيل | ⏳ جاري التفعيل... | معطل + مؤشر تحميل |

### بعد الضغط

```
ضغط "🔐 تفعيل"
    │
    ├── تأكيد: "سيتم إنشاء حساب Firebase Auth للتاجر. هل تتابع؟"
    │
    ├── نعم → استدعاء provisionMerchantAuth(merchantId, phone, email)
    │   │
    │   ├── نجاح → تحديث merchantDoc.firebaseAuthUid
    │   │         → عرض رسالة: ✅ تم التفعيل
    │   │         → تغيير الحالة لـ 🟢
    │   │
    │   └── فشل → عرض رسالة: ❌ [سبب الفشل]
    │            → زر: 🔄 إعادة المحاولة
    │
    └── لا → لا شيء
```

---

## 4. الملفات التي ستتغير

| الملف | التغيير |
|-------|---------|
| `functions/provisionAuth.js` | + بعد نجاح إنشاء Auth: كتابة `firebaseAuthUid` في مستند التاجر |
| `functions/provisionAuth.js` | + دالة جديدة `checkMerchantAuthStatus(merchantId)` |
| `admin/app.js` | تعديل `handleLogin()` — Firebase Auth أولاً → Legacy fallback |
| `admin/app.js` | تعديل `handleLogout()` — `firebase.auth().signOut()` + localStorage |
| `admin/app.js` | إضافة `onAuthStateChanged` (سلبي — لا يؤثر على UI) |
| `admin/modules/merchants.js` | + عمود "حالة Firebase" + 3 حالات |
| `admin/modules/merchants.js` | + زر "🔐 تفعيل Firebase Authentication" |
| `admin/modules/merchants.js` | + `activateFirebaseAuth(merchantId)` |
| `admin/index.html` | بدون تغيير |

---

## 5. هل النظام الحالي يتأثر؟

| المكوّن | هل يتغير؟ |
|---------|-----------|
| واجهة تسجيل الدخول | ❌ لا — نفس الزر، نفس الحقول |
| طريقة الدخول القديمة (Firestore) | ❌ لا — ما زالت تعمل كـ Fallback |
| إنشاء تاجر | ❌ لا — `saveMerchant()` لا تستدعي Firebase Auth |
| Merchant App | ❌ لا — لم يُمس |
| Firebase Security Rules | ❌ لا — لم تُنشر |
| أي كود Legacy | ❌ لا — لم يُحذف |

---

## 6. اختبارات ما قبل الانتقال لـ Phase 2

- [ ] `handleLogin()`: Firebase Auth يعمل
- [ ] `handleLogin()`: Legacy Fallback يعمل (إذا Firebase Auth معطل)
- [ ] `handleLogin()`: إذا Firebase فشل وLegacy فشل → رسالة خطأ صحيحة
- [ ] `handleLogout()`: يمسح Firebase Auth + localStorage
- [ ] تجارة حقيقية: تفعيل Firebase Auth يعمل
- [ ] تجارة حقيقية: إعادة المحاولة بعد الفشل
- [ ] حالة 🟢 ظاهرة بعد التفعيل
- [ ] حالة 🔴 ظاهرة للتجار غير المفعلين
- [ ] Idempotent: الضغط مرتين لا يُنشئ duplicate
