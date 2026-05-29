import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyDO6-LTuBoNHi6uS5KcOpmBuyvgJSouYpk",
  authDomain: "id4drive-booking-44182.firebaseapp.com",
  databaseURL: "https://id4drive-booking-44182-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "id4drive-booking-44182",
  storageBucket: "id4drive-booking-44182.firebasestorage.app",
  messagingSenderId: "815176240686",
  appId: "1:815176240686:web:1cf54d6c465420230199bf"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getDatabase(app);
