package ai.mobi.posecamera

import expo.modules.kotlin.exception.CodedException

// JS 는 error.code 로 분기한다. 코드 목록은 src/PoseCamera.types.ts 의 PoseCameraErrorCode 와 맞춘다.

class CameraPermissionException :
  CodedException("ERR_CAMERA_PERMISSION", "카메라 권한이 없습니다", null)

class NoCameraException :
  CodedException("ERR_NO_CAMERA", "앱이 쓸 수 있는 카메라가 없습니다", null)

class CameraFailedException(message: String, cause: Throwable? = null) :
  CodedException("ERR_CAMERA_FAILED", message, cause)

class CameraBusyException :
  CodedException("ERR_CAMERA_BUSY", "이미 촬영 중입니다", null)

class CameraTimeoutException :
  CodedException("ERR_CAMERA_TIMEOUT", "카메라에서 화면이 오지 않았습니다", null)

class PoseFailedException(cause: Throwable?) :
  CodedException("ERR_POSE_FAILED", "자세 인식에 실패했습니다: ${cause?.message}", cause)

class QrFailedException(cause: Throwable?) :
  CodedException("ERR_QR_FAILED", "QR 코드 인식에 실패했습니다: ${cause?.message}", cause)
