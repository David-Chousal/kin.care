export type UserRole = 'admin' | 'member' | 'viewer';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

export interface Family {
  id: string;
  name: string;
  care_recipient_name: string;
  created_by: string;
  created_at: string;
}

export interface FamilyMember {
  id: string;
  family_id: string;
  user_id: string;
  role: UserRole;
  joined_at: string;
  profile?: Profile;
}

export interface Task {
  id: string;
  family_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  due_date: string | null;
  completed: boolean;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

export interface Invitation {
  id: string;
  family_id: string;
  email: string;
  role: UserRole;
  token: string;
  accepted: boolean;
  created_at: string;
}
