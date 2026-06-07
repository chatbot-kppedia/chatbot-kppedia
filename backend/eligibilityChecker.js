// backend/eligibilityChecker.js
const SKS_MIN = 90;
const IPK_MIN = 2.75;

class EligibilityChecker {
  constructor() {
    // Menyimpan sesi per user (key: userId, value: { step, sks, ipk })
    this.sessions = new Map();
  }

  // Memulai proses eligibility
  start(userId) {
    this.sessions.set(userId, { step: 'ask_sks', sks: null, ipk: null });
    return {
      done: false,
      message: 'Berapa total SKS yang sudah Anda tempuh?',
      question: 'sks'
    };
  }

  // Memproses input user
  processInput(userId, userMessage) {
    const session = this.sessions.get(userId);
    if (!session) {
      // Tidak dalam sesi eligibility
      return { done: true, message: null };
    }

    const numericValue = parseFloat(userMessage);
    if (isNaN(numericValue)) {
      return {
        done: false,
        message: 'Mohon masukkan angka yang valid.',
        question: session.step === 'ask_sks' ? 'sks' : 'ipk'
      };
    }

    if (session.step === 'ask_sks') {
      session.sks = numericValue;
      session.step = 'ask_ipk';
      return {
        done: false,
        message: 'Berapa IPK Anda saat ini?',
        question: 'ipk'
      };
    } 
    
    if (session.step === 'ask_ipk') {
      session.ipk = numericValue;
      // Hitung eligibility
      const result = this.check(session.sks, session.ipk);
      // Hapus sesi setelah selesai
      this.sessions.delete(userId);
      return {
        done: true,
        message: result.message,
        eligible: result.eligible,
        reasons: result.reasons
      };
    }
  }

  // Logika eligibility murni (bisa dipakai terpisah)
  check(sks, ipk) {
    const sksOk = sks >= SKS_MIN;
    const ipkOk = ipk >= IPK_MIN;

    if (sksOk && ipkOk) {
      return {
        eligible: true,
        message: '✅ Selamat, Anda memenuhi syarat untuk mengikuti Kerja Praktik.',
        reasons: []
      };
    }

    const reasons = [];
    if (!sksOk) reasons.push(`• SKS Anda ${sks} (minimal ${SKS_MIN})`);
    if (!ipkOk) reasons.push(`• IPK Anda ${ipk} (minimal ${IPK_MIN})`);

    return {
      eligible: false,
      message: `❌ Anda belum memenuhi syarat KP.\n\nAlasan:\n${reasons.join('\n')}`,
      reasons
    };
  }
}

module.exports = EligibilityChecker;