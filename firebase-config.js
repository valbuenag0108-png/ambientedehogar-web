// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAiV8pZa0mwGEY1alKpiicSD9w7tP4tARY",
  authDomain: "ambiente-de-hogar.firebaseapp.com",
  projectId: "ambiente-de-hogar",
  storageBucket: "ambiente-de-hogar.firebasestorage.app",
  messagingSenderId: "1035045561992",
  appId: "1:1035045561992:web:c0e0be64364347f785613d",
  measurementId: "G-ZEM4QX18Y2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);