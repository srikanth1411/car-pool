---
name: Frontend Requirements
description: Non-negotiable UI/UX rules for the Expo/React Native mobile app
type: feedback
---

These rules apply to every screen and component in the mobile app (`mobile-app/`).

## Layout & Keyboard

- **No `KeyboardAvoidingView` anywhere in the app.** All screens use `ScrollView` with `keyboardShouldPersistTaps="handled"` for input handling. Never wrap screens or modals with `KeyboardAvoidingView` or import `Platform` for that purpose.

## Image Uploads

- **Camera + Library picker required.** Every image upload must present an action sheet with two options: "Take Photo" (camera) and "Photo Library". Single-source pickers (library only) are not allowed.
  - Use the shared utility `src/utils/pickImage.ts` → `pickAndUploadImage()` for all image uploads.
- **5 MB size limit.** Reject any image where `asset.fileSize > 5 * 1024 * 1024` with the alert: "Please choose an image under 5 MB."

## How to apply

- Before adding any new screen with a text input: confirm no `KeyboardAvoidingView` is introduced.
- Before adding any image upload button: use `pickAndUploadImage()` — do not inline a new `ImagePicker` call.
- Violations of these rules must be fixed before committing.
