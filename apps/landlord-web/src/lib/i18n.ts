import i18n from "i18next";
import { initReactI18next } from "react-i18next";

const resources = {
  zh: {
    translation: {
      login: {
        title: "房东管理平台",
        subtitle: "输入邮箱，我们将发送登录链接",
        emailLabel: "电子邮箱",
        emailPlaceholder: "landlord@example.com",
        sendBtn: "发送登录链接",
        sending: "发送中...",
        successTitle: "邮件已发送",
        successDesc: "请检查收件箱，点击链接即可登录。",
        errorEmpty: "请输入邮箱地址",
        footer: "EZBill · 泰国房东水电账单管理系统",
      },
      nav: {
        dashboard: "仪表盘",
        properties: "楼盘管理",
        bills: "账单管理",
        settings: "设置",
      },
      dashboard: {
        properties: "楼盘数",
        rooms: "房间数",
        monthBills: "本月账单",
        pending: "待收款",
        comingSoon: "功能开发中…",
        recentBills: "最近账单",
        noBills: "暂无账单记录",
        colRoom: "房间",
        colPeriod: "账期",
        colAmount: "金额",
        colStatus: "状态",
        statusPending: "待支付",
        statusPaid: "已支付",
        statusOverdue: "已逾期",
      },
    },
  },
  en: {
    translation: {
      login: {
        title: "Landlord Management",
        subtitle: "Enter your email to receive a login link",
        emailLabel: "Email address",
        emailPlaceholder: "landlord@example.com",
        sendBtn: "Send login link",
        sending: "Sending...",
        successTitle: "Email sent",
        successDesc: "Check your inbox and click the link to sign in.",
        errorEmpty: "Please enter your email address",
        footer: "EZBill · Utility Bill Management for Thai Landlords",
      },
      nav: {
        dashboard: "Dashboard",
        properties: "Properties",
        bills: "Bills",
        settings: "Settings",
      },
      dashboard: {
        properties: "Properties",
        rooms: "Rooms",
        monthBills: "Bills This Month",
        pending: "Pending",
        comingSoon: "Coming soon…",
        recentBills: "Recent Bills",
        noBills: "No bills yet",
        colRoom: "Room",
        colPeriod: "Period",
        colAmount: "Amount",
        colStatus: "Status",
        statusPending: "Pending",
        statusPaid: "Paid",
        statusOverdue: "Overdue",
      },
    },
  },
  th: {
    translation: {
      login: {
        title: "ระบบจัดการเจ้าของบ้าน",
        subtitle: "กรอกอีเมลเพื่อรับลิงก์เข้าสู่ระบบ",
        emailLabel: "อีเมล",
        emailPlaceholder: "landlord@example.com",
        sendBtn: "ส่งลิงก์เข้าสู่ระบบ",
        sending: "กำลังส่ง...",
        successTitle: "ส่งอีเมลแล้ว",
        successDesc: "กรุณาตรวจสอบกล่องจดหมายและคลิกลิงก์เพื่อเข้าสู่ระบบ",
        errorEmpty: "กรุณากรอกที่อยู่อีเมล",
        footer: "EZBill · ระบบจัดการบิลน้ำไฟสำหรับเจ้าของบ้านในไทย",
      },
      nav: {
        dashboard: "แดชบอร์ด",
        properties: "จัดการอสังหาริมทรัพย์",
        bills: "จัดการบิล",
        settings: "การตั้งค่า",
      },
      dashboard: {
        properties: "อสังหาริมทรัพย์",
        rooms: "ห้องพัก",
        monthBills: "บิลเดือนนี้",
        pending: "รอการชำระ",
        comingSoon: "กำลังพัฒนา…",
        recentBills: "บิลล่าสุด",
        noBills: "ยังไม่มีบิล",
        colRoom: "ห้อง",
        colPeriod: "งวด",
        colAmount: "จำนวนเงิน",
        colStatus: "สถานะ",
        statusPending: "รอชำระ",
        statusPaid: "ชำระแล้ว",
        statusOverdue: "เกินกำหนด",
      },
    },
  },
};

const savedLang = localStorage.getItem("ezbill_lang");
const browserLang = navigator.language.split("-")[0];
const defaultLang = savedLang || (["zh", "en", "th"].includes(browserLang) ? browserLang : "zh");

i18n.use(initReactI18next).init({
  resources,
  lng: defaultLang,
  fallbackLng: "zh",
  interpolation: { escapeValue: false },
});

export default i18n;
