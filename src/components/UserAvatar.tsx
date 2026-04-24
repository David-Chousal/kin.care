import { View, Text, Image, StyleSheet } from 'react-native';
import { profileAvatarPublicUrl } from '../features/profile/profileAvatarStorage';

type Props = {
  size: number;
  /** Storage object path `{user_id}/filename` from `profiles.avatar_url`. */
  avatarStoragePath?: string | null;
  initials: string;
  backgroundColor: string;
  textColor: string;
};

export function UserAvatar({ size, avatarStoragePath, initials, backgroundColor, textColor }: Props) {
  const radius = size / 2;
  const uri = profileAvatarPublicUrl(avatarStoragePath ?? null);
  const displayInitials = initials.slice(0, 2).toUpperCase();
  const fontSize = Math.max(9, Math.round(size * 0.42));

  if (uri) {
    return (
      <View style={[styles.wrap, { width: size, height: size, borderRadius: radius }]}>
        <Image source={{ uri }} style={[styles.image, { width: size, height: size, borderRadius: radius }]} />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.wrap,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
      ]}
    >
      <Text style={{ color: textColor, fontSize, fontWeight: '700' }}>{displayInitials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { overflow: 'hidden' },
  image: { resizeMode: 'cover' },
});
