package ai.mobi.pleosconnect

import expo.modules.kotlin.exception.CodedException

// JS 는 error.code 로 분기한다. 코드 목록은 src/PleosConnect.types.ts 의 PleosErrorCode 와 맞춘다.

class NotAutomotiveException :
  CodedException("ERR_NOT_AUTOMOTIVE", "Android Automotive(Pleos Connect) 기기가 아닙니다", null)

class NotParkedException :
  CodedException("ERR_NOT_PARKED", "기어가 P 가 아니어서 시트를 움직이지 않았습니다", null)

class SeatUnsupportedException(axis: SeatAxis) :
  CodedException("ERR_SEAT_UNSUPPORTED", "이 차량은 운전석 ${axis.value} 조절을 지원하지 않습니다", null)

class SeatMoveFailedException(message: String, cause: Throwable? = null) :
  CodedException("ERR_SEAT_MOVE_FAILED", message, cause)

class PleosServiceException(message: String, cause: Throwable? = null) :
  CodedException("ERR_PLEOS_SERVICE", message, cause)

// 음성 인식 서비스에는 연결됐지만 정해진 시간 안에 말소리를 알아듣지 못했다. 서비스 오류와 안내 문구가 달라 따로 둔다.
class NoSpeechException(message: String, cause: Throwable? = null) :
  CodedException("ERR_NO_SPEECH", message, cause)

class DrivingRestrictedException(cause: Throwable?) :
  CodedException("ERR_DRIVING_RESTRICTED", "주행 중 제한으로 차량이 요청을 거부했습니다", cause)

class PermissionDeniedException(cause: Throwable?) :
  CodedException("ERR_PERMISSION_DENIED", "Pleos 권한이 없거나 승인되지 않았습니다", cause)

// Vehicle SDK 오류 처리 가이드: onFailed 의 예외에서 ErrorCode 를 확인해 오류별로 안내한다.
// 2.3.2 AAR 은 문서의 VehicleException 이름이 난독화돼 있고(callback.exception.a), ErrorCode 가 든 vehicle-data 는
// runtime 의존성이라 컴파일 때 참조할 수 없다. 그래서 ErrorCode 를 돌려주는 메서드와 상수를 이름으로 찾아 비교한다.
private const val ERROR_CODE_CLASS = "ai.pleos.playground.vehicle.constant.ErrorCode"

private fun vehicleErrorIs(error: Throwable?, name: String): Boolean =
  runCatching {
    val type = Class.forName(ERROR_CODE_CLASS)
    val getter = error?.javaClass?.methods?.firstOrNull { it.parameterCount == 0 && it.returnType == type }
    getter != null && getter.invoke(error) == type.getField(name).get(null)
  }.getOrDefault(false)

internal fun pleosFailure(error: Throwable?): CodedException =
  when {
    vehicleErrorIs(error, "ERROR_DRIVING_RESTRICTED") -> DrivingRestrictedException(error)
    vehicleErrorIs(error, "ERROR_SECURITY_PERMISSION") -> PermissionDeniedException(error)
    else -> PleosServiceException("Pleos 호출 실패: ${error?.message}", error)
  }
