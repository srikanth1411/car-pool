import { Alert } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import { uploadFile } from '../api/upload'

/**
 * Shows a Camera / Photo Library action sheet, handles permissions,
 * launches the appropriate picker, uploads the image, and returns the URL.
 * Returns null if the user cancels or an error occurs.
 */
export function pickAndUploadImage(onUploading: (uploading: boolean) => void): Promise<string | null> {
  return new Promise((resolve) => {
    Alert.alert(
      'Add Photo',
      'Choose a source',
      [
        {
          text: 'Take Photo',
          onPress: () => launchSource('camera', onUploading, resolve),
        },
        {
          text: 'Photo Library',
          onPress: () => launchSource('library', onUploading, resolve),
        },
        { text: 'Cancel', style: 'cancel', onPress: () => resolve(null) },
      ],
    )
  })
}

async function launchSource(
  source: 'camera' | 'library',
  onUploading: (uploading: boolean) => void,
  resolve: (url: string | null) => void,
) {
  try {
    let result: ImagePicker.ImagePickerResult

    if (source === 'camera') {
      const { status } = await ImagePicker.requestCameraPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow camera access in Settings.')
        return resolve(null)
      }
      result = await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
    } else {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission required', 'Please allow photo library access in Settings.')
        return resolve(null)
      }
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.8 })
    }

    if (result.canceled || !result.assets?.[0]) return resolve(null)

    const asset = result.assets[0]
    onUploading(true)
    const url = await uploadFile(asset.uri, asset.fileName ?? 'photo.jpg', asset.mimeType ?? 'image/jpeg')
    resolve(url)
  } catch (e) {
    Alert.alert('Upload failed', String(e))
    resolve(null)
  } finally {
    onUploading(false)
  }
}
