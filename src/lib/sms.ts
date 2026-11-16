/**
 * 手机号验证码登录的预留接口。
 * 现在的注册和登录只用用户名 / 邮箱 + 密码。
 * 以后接入短信时：实现 SmsCodeSender，把 SMS_PROVIDER 设为具体通道，
 * 再在登录页调用 sendLoginCode。不要把密钥写进代码。
 */
export interface SmsCodeSender {
  sendLoginCode(phone: string, code: string): Promise<void>;
}

export function getSmsSender(): SmsCodeSender | null {
  const provider = (process.env.SMS_PROVIDER || "none").trim().toLowerCase();
  if (!provider || provider === "none") return null;
  return {
    async sendLoginCode() {
      throw new Error(`短信通道「${provider}」还没有实现`);
    },
  };
}
