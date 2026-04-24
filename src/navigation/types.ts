import type { FeatureId } from '../subscription/featureTierConfig';

export type MainStackParamList = {
  Home: undefined;
  Tasks: undefined;
  Calendar:
    | {
        openAdd?: boolean;
        draft?: {
          title?: string;
          description?: string;
          location?: string;
          startsAt?: string;
          includeTime?: boolean;
        };
      }
    | undefined;
  VisitPrep: undefined;
  Doctors: undefined;
  Medications: undefined;
  MedicationDetail: { medicationId: string };
  Health: undefined;
  Documents: undefined;
  CheckIns: undefined;
  Members: undefined;
  InviteMember: undefined;
  Settings: undefined;
  Accessibility: undefined;
  Notifications: undefined;
  Appearance: undefined;
  Language: undefined;
  DataPrivacy: undefined;
  Notes: undefined;
  Subscription: { featureId?: FeatureId } | undefined;
};

export type AuthStackParamList = {
  WelcomeHub: undefined;
  SignIn: undefined;
  SignUp: undefined;
  ForgotPassword: undefined;
  JoinFamilyInfo: undefined;
};
