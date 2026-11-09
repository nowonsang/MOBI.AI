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
