package ai.mobi.posecamera

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.hardware.camera2.CameraManager
import expo.modules.interfaces.permissions.Permissions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

// Android 표준 카메라 + 기기 안 자세 인식·QR 읽기를 JS 로 노출한다. JS 쪽 계약은 src/PoseCameraModule.ts·PoseCameraView.tsx 와 맞춘다.
// 차량 SDK(Pleos)와 무관해 pleos-connect 와 나눴다. 주차 여부는 이 모듈이 아니라 화면(JS)이 확인한다 (카메라는 차를 움직이지 않는다).
class PoseCameraModule : Module() {
  private val context: Context
    get() = appContext.reactContext?.applicationContext ?: throw Exceptions.ReactContextLost()

  override fun definition() =
    ModuleDefinition {
      Name("PoseCamera")

      // 앱이 열 수 있는 카메라가 하나라도 있는지. 차량에 따라 Camera2 장치가 없을 수 있어 화면을 열기 전에 확인한다.
      // PackageManager 의 카메라 feature 는 보지 않는다: Pleos Connect 에뮬레이터는 feature 없이 장치만 알려 준다.
      Function("hasCamera") {
        runCatching {
          val manager = context.getSystemService(Context.CAMERA_SERVICE) as CameraManager
          manager.cameraIdList.isNotEmpty()
        }.getOrDefault(false)
      }

      AsyncFunction("getCameraPermission") { promise: Promise ->
        Permissions.getPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.CAMERA)
      }

      // 권한 창은 운전자가 "카메라로 재기"를 눌렀을 때만 띄운다 (앱을 켤 때 묻지 않는다).
      AsyncFunction("requestCameraPermission") { promise: Promise ->
        Permissions.askForPermissionsWithPermissionsManager(appContext.permissions, promise, Manifest.permission.CAMERA)
      }

      // 주행 중 자세 관찰. 앱이 화면에 보이는 주차(P) 중에 시작해야 한다 (Android 14 카메라 포그라운드 서비스 제한).
      Function("startPostureWatch") {
        if (context.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
          throw CameraPermissionException()
        }
        PostureWatchService.start(context)
      }

      Function("stopPostureWatch") { PostureWatchService.stop(context) }

      Function("getPostureWatchStatus") { PostureWatchStore.status() }

      // 모은 관절 표본을 넘기고 비운다. 사진은 없고 관절 좌표와 시각뿐이다.
      Function("drainPostureSamples") { PostureWatchStore.drain() }

      View(PoseCameraView::class) {
        Events("onCameraReady", "onCameraError")

        Prop("cameraIndex") { view: PoseCameraView, index: Int? -> view.setCameraIndex(index ?: 0) }

        // 지금 보이는 화면 한 장에서 관절 위치만 뽑아 돌려준다. 사진은 돌려주지도 저장하지도 않는다.
        AsyncFunction("capturePose") { view: PoseCameraView, promise: Promise -> view.capturePose(promise) }

        // 지금 보이는 화면 한 장에서 QR 코드의 글자만 읽어 돌려준다. 없으면 text 가 null 이다.
        AsyncFunction("scanQrCode") { view: PoseCameraView, promise: Promise -> view.scanQrCode(promise) }

        OnViewDestroys { view: PoseCameraView -> view.release() }
      }
    }
}
