export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, AppError.prototype);
  }

  static badRequest(message: string) {
    return new AppError(message, 400, 'BAD_REQUEST');
  }

  static unauthorized(message = '未登录') {
    return new AppError(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(message = '无权限') {
    return new AppError(message, 403, 'FORBIDDEN');
  }

  static notFound(message = '资源不存在') {
    return new AppError(message, 404, 'NOT_FOUND');
  }

  static conflict(message: string) {
    return new AppError(message, 409, 'CONFLICT');
  }

  static internal(message = '服务器内部错误') {
    return new AppError(message, 500, 'INTERNAL_ERROR');
  }
}
