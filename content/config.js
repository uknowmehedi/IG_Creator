window.CREATOR_PRO_CONFIG = {
  signup: {
    email:     'input[name="emailOrPhone"], input[name="email"], input[type="email"]',
    fullName:  'input[name="fullName"]',
    username:  'input[name="username"]',
    password:  'input[name="password"], input[type="password"]',
    // :contains বাদ — পরে JS দিয়ে টেক্সট ম্যাচ করব
    submitBtn: 'form button[type="submit"], button[type="submit"], button._acan._acap._acas',
    dob: {
      month: 'select[title="Month:"]',
      day:   'select[title="Day:"]',
      year:  'select[title="Year:"]',
      nextBtn: 'button._aswp._aswr._asws, button[type="submit"]'
    }
  },
  verify: {
    codeText:  '.otp, .code, [data-otp], body',
    codeInput: 'input[name="code"], input[autocomplete="one-time-code"], input[type="tel"]',
    submitBtn: 'button[type="submit"], button.verify'
  }
};
