import { Redirect } from 'expo-router';

/** BLE is integrated into the Dashboard — keep route for old links. */
export default function BluetoothRedirect() {
  return <Redirect href="/(tabs)" />;
}
