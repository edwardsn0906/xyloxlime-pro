// ============================================================================
// FIREBASE CONFIGURATION
// ============================================================================
//
// INSTRUCTIONS:
// 1. Go to Firebase Console: https://console.firebase.google.com/
// 2. Select your project
// 3. Go to Project Settings (gear icon) → Your apps → Web app
// 4. Copy the firebaseConfig object
// 5. Replace the placeholder values below with your actual config
//
// NOTE: It's safe to expose these values in your frontend code.
// Security comes from Firestore Security Rules, not hiding these keys.
// ============================================================================

const firebaseConfig = {
    apiKey: "AIzaSyBWPx5bGeO8pwE1M_PJhnrAfi-M9Buid-g",
    authDomain: "xyloclime-pro.firebaseapp.com",
    projectId: "xyloclime-pro",
    storageBucket: "xyloclime-pro.firebasestorage.app",
    messagingSenderId: "621932987940",
    appId: "1:621932987940:web:534ce49e8a690a10e43ab1"
};

// Initialize Firebase
let app, auth, db, storage;

try {
    app = firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    storage = firebase.storage();

    console.log('[FIREBASE] ✅ Firebase initialized successfully');
    console.log('[FIREBASE] Project:', firebaseConfig.projectId);
} catch (error) {
    console.error('[FIREBASE] ❌ Firebase initialization failed:', error);
    alert('Firebase initialization failed. Check console for details.');
}

// Export for use in other files
window.firebaseApp = app;
window.firebaseAuth = auth;
window.firebaseDb = db;
window.firebaseStorage = storage;
