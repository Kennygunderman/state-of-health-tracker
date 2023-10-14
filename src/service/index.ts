import { FirebaseApp } from '@firebase/app';
import { initializeApp } from 'firebase/app';
import { firebaseConfig } from '../../config';

const app: FirebaseApp = initializeApp(firebaseConfig);
export default app;
