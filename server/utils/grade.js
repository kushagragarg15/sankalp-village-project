// `grade` stays a free-text column ("Class 4", "All") exactly as it was in
// Mongo, so display and admin-entered values are unaffected. `gradeNumber` is
// parsed once at write time and used for the ±1 adjacency filter that used to
// be a `nearbyGradePatterns` regex built at query time (see ragService.js).
function parseGradeNumber(grade) {
  const match = String(grade || '').match(/\d+/);
  return match ? parseInt(match[0], 10) : null;
}

module.exports = { parseGradeNumber };
