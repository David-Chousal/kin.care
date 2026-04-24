import { Platform } from 'react-native';

/** Play Store uses application id from app.json */
export const ANDROID_PACKAGE = 'com.dchousal.kincare';

export const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

/** iTunes search (no public App Store numeric id required in-repo). */
export const IOS_APP_SEARCH_URL =
  'https://apps.apple.com/search?term=kin.care%20family%20care';
