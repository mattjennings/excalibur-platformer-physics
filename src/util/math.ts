export function getVecAngle(v1: ex.Vector, v2: ex.Vector) {
  return Math.acos(v1.dot(v2) / (v1.size * v2.size))
}
