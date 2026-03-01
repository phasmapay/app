import * as Haptics from 'expo-haptics';

export const hapticPatterns = {
  paymentSuccess: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise(r => setTimeout(r, 80));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise(r => setTimeout(r, 80));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  nfcTap: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  tierUpgrade: async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await new Promise(r => setTimeout(r, 60));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    await new Promise(r => setTimeout(r, 60));
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    await new Promise(r => setTimeout(r, 100));
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error),
  tap: () => Haptics.selectionAsync(),
};
