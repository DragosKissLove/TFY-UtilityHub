import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
    apiKey: "AIzaSyCrRg6ZJiej8hy8goi5HcbZDoiIsfVcydQ",
    authDomain: "tfy-project.firebaseapp.com",
    databaseURL: "https://tfy-project-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "tfy-project",
    storageBucket: "tfy-project.firebasestorage.app",
    messagingSenderId: "803968480824",
    appId: "1:803968480824:web:fe5e053fa263051bc958cd"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
