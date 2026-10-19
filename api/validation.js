const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const localImagePattern = /^\/(?:assets|uploads)\/[A-Za-z0-9._/-]+\.(?:jpe?g|png|webp|gif|svg)$/i;

export function validateAdminProfile(body) {
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  if (!fullName || fullName.length > 100) return "Enter a name of up to 100 characters.";
  if (phone && !/^\d{10}$/.test(phone)) return "Enter a valid 10-digit mobile number.";
  if (email && (email.length > 254 || !emailPattern.test(email))) return "Enter a valid email address.";
  if (imageUrl && !localImagePattern.test(imageUrl)) return "Choose a profile image from this device.";
  return { fullName, phone, email, imageUrl };
}

export function validateAppointment(body) {
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const age = Number(body.age);
  const gender = body.gender;
  const phone = typeof body.phone === "string" ? body.phone.replace(/\D/g, "") : "";
  const email = typeof body.email === "string" ? body.email.trim() : "";
  const problem = typeof body.problem === "string" ? body.problem.trim() : "";
  if (!name || name.length > 80) return "Enter a patient name (up to 80 characters).";
  if (!Number.isInteger(age) || age < 1 || age > 120) return "Enter a valid patient age.";
  if (!["Female", "Male", "Other"].includes(gender)) return "Select a valid gender.";
  if (!/^\d{10}$/.test(phone)) return "Enter a valid 10-digit Indian mobile number.";
  if (email && (email.length > 254 || !emailPattern.test(email))) return "Enter a valid email address.";
  if (problem.length > 1000) return "Describe the problem in 1,000 characters or fewer.";
  return { name, age, gender, phone, email, problem };
}

export function validateSiteContent(content) {
  if (!content || typeof content !== "object" || !content.clinic || !Array.isArray(content.gallery) ||
      !Array.isArray(content.specialties) || !content.promotion) {
    return "Website settings are incomplete.";
  }
  if (typeof content.clinic.name !== "string" || !content.clinic.name.trim()) return "Clinic name is required.";
  if (!Array.isArray(content.clinic.phones) ||
      content.clinic.phones.some(phone => !/^\d{10}$/.test(String(phone).replace(/\D/g, "")))) {
    return "Clinic phone numbers must each contain exactly 10 digits.";
  }
  if (content.clinic.email && !emailPattern.test(content.clinic.email)) return "Enter a valid clinic email address.";
  if (content.gallery.length > 40) return "The gallery can contain at most 40 images.";
  if (content.specialties.length > 50) return "Too many specialties were submitted.";
  const images = [
    ...content.gallery.map(item => item?.image),
    ...content.specialties.map(item => item?.image),
    content.promotion.image
  ].filter(Boolean);
  if (images.some(image => typeof image !== "string" || !localImagePattern.test(image))) {
    return "Use images uploaded to the clinic website.";
  }
  return null;
}
