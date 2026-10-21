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

export function validateDoctors(body) {
  if (!Array.isArray(body) || body.length > 50) return "The doctors list must contain at most 50 entries.";
  const ids = new Set();
  const doctors = [];
  for (const item of body) {
    const id = typeof item?.id === "string" ? item.id.trim() : "";
    const name = typeof item?.name === "string" ? item.name.trim() : "";
    const qualification = typeof item?.qualification === "string" ? item.qualification.trim() : "";
    const description = typeof item?.description === "string" ? item.description.trim() : "";
    const expertise = typeof item?.expertise === "string" ? item.expertise.trim() : "";
    const image = typeof item?.image === "string" ? item.image.trim() : "";
    if (!id || id.length > 80 || ids.has(id)) return "Each doctor must have a unique identifier.";
    if (!name || name.length > 100) return "Enter each doctor's name (up to 100 characters).";
    if (qualification.length > 160) return "Doctor qualifications must be 160 characters or fewer.";
    if (!description || description.length > 1000) return "Enter a doctor description of up to 1,000 characters.";
    if (!expertise || expertise.length > 300) return "Enter doctor expertise of up to 300 characters.";
    if (image && !localImagePattern.test(image)) return "Use a doctor image uploaded to the clinic website.";
    ids.add(id);
    doctors.push({ id, name, qualification, description, expertise, image });
  }
  return doctors;
}
