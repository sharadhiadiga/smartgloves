import { Redirect } from 'expo-router';

/** Legacy route — dashboard uses WiFi/API polling. */
export default function BluetoothRedirect() {
  return <Redirect href="/(tabs)" />;
}
