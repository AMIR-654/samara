/**
 * Seed Test Data for Phase 2.5 Integration Testing
 * 
 * Usage: node seed_test_data.js
 * 
 * WARNING: Creates test merchants in the 'merchants' collection with
 * '_test_' prefix for easy identification and cleanup.
 * 
 * Cleanup: node seed_test_data.js --cleanup
 */

const { initializeApp } = require("firebase/app");
const { getFirestore, doc, setDoc, getDoc, collection, getDocs, deleteDoc, query, where } = require("firebase/firestore");
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require("firebase/auth");

const firebaseConfig = {
  apiKey: "AIzaSyD15jjDHKnJJSTIiS1qkqHOp8LGN7gIRD4",
  authDomain: "samara-560ad.firebaseapp.com",
  projectId: "samara-560ad",
  storageBucket: "samara-560ad.firebasestorage.app",
  messagingSenderId: "838230946676",
  appId: "1:838230946676:web:9ac33c5ee94f47c8407221",
};

// Helper: simple hash matching the merchant app
function hashPassword(password) {
  let hash = 0;
  for (let i = 0; i < password.length; i++) {
    const char = password.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "h_" + Math.abs(hash).toString(36);
}

async function seed() {
  const app = initializeApp(firebaseConfig, "test_seed");
  const db = getFirestore(app);
  const auth = getAuth(app);

  const testMerchants = [
    {
      id: "_test_merchant_legacy",
      name: "[TEST] تاجر Legacy فقط",
      phone: "01000000001",
      username: "test_merchant_legacy",
      password: hashPassword("merchLeg1"),
      status: "active",
      address: "شارع الاختبار",
      supportsInstallations: false,
      totalCards: 10,
      totalCardValue: 5000,
      totalSettlements: 2000,
      totalCollections: 1000,
      currentBalance: 3000,
      installationCount: 2,
      createdBy: "test_script",
      // No firebaseAuthUid — this is a legacy-only merchant
    },
    {
      id: "_test_merchant_firebase",
      name: "[TEST] تاجر Firebase",
      phone: "01000000002",
      username: "test_merchant_firebase",
      password: hashPassword("merchFire1"),
      email: "merchant_m2@test.local",
      status: "active",
      address: "شارع Firebase",
      supportsInstallations: true,
      totalCards: 20,
      totalCardValue: 10000,
      totalSettlements: 5000,
      totalCollections: 2000,
      currentBalance: 8000,
      installationCount: 5,
      createdBy: "test_script",
      // firebaseAuthUid setzen wir später nach der Firebase User Erstellung
    },
    {
      id: "_test_merchant_needs_sync",
      name: "[TEST] تاجر يحتاج مزامنة",
      phone: "01000000003",
      username: "test_merchant_needs_sync",
      password: hashPassword("syncMe123"),
      status: "active",
      address: "شارع المزامنة",
      supportsInstallations: false,
      totalCards: 5,
      totalCardValue: 2500,
      totalSettlements: 1000,
      totalCollections: 500,
      currentBalance: 1500,
      installationCount: 1,
      createdBy: "test_script",
      firebaseAuthUid: "fake_uid_for_sync_test",
      firebaseAuthStatus: "needs_sync",
    },
    {
      id: "_test_merchant_archived",
      name: "[TEST] تاجر مؤرشف",
      phone: "01000000004",
      username: "test_merchant_archived",
      password: hashPassword("archived1"),
      status: "archived",
      address: "شارع الأرشيف",
      supportsInstallations: false,
      totalCards: 0,
      totalCardValue: 0,
      totalSettlements: 0,
      totalCollections: 0,
      currentBalance: 0,
      installationCount: 0,
      createdBy: "test_script",
    },
  ];

  for (const m of testMerchants) {
    const ref = doc(db, "merchants", m.id);
    await setDoc(ref, {
      ...m,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    console.log(`✅ Created test merchant: ${m.id} (${m.name})`);
  }

  console.log("\n🎉 Test data seeded successfully!");
  console.log("\nNext steps:");
  console.log("  1. Open Admin Panel → login with test_admin_legacy / test123");
  console.log("  2. Open Merchant App → login with test_merchant_legacy / merchLeg1");
  console.log("  3. Test 🟡 status by checking _test_merchant_needs_sync in Admin Panel");
  process.exit(0);
}

async function cleanup() {
  const app = initializeApp(firebaseConfig, "test_cleanup");
  const db = getFirestore(app);

  const q = query(collection(db, "merchants"), where("createdBy", "==", "test_script"));
  const snap = await getDocs(q);
  let count = 0;

  for (const doc of snap.docs) {
    await deleteDoc(doc.ref);
    count++;
  }

  console.log(`🧹 Cleaned up ${count} test merchants`);
  process.exit(0);
}

const args = process.argv.slice(2);
if (args.includes("--cleanup")) {
  cleanup();
} else {
  seed();
}
