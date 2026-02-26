import { NativeModules, Platform } from 'react-native';

const { HceModule } = NativeModules;

export async function startHce(solanaPayUrl: string): Promise<void> {
  if (Platform.OS !== 'android') {
    throw new Error('HCE is only available on Android');
  }
  if (!HceModule) {
    throw new Error('HCE native module not available');
  }
  await HceModule.startEmulation(solanaPayUrl);
}

export async function stopHce(): Promise<void> {
  if (Platform.OS !== 'android' || !HceModule) return;
  await HceModule.stopEmulation();
}

export async function isHceEmulating(): Promise<boolean> {
  if (Platform.OS !== 'android' || !HceModule) return false;
  return HceModule.isEmulating();
}
