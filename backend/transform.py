import numpy as np

from backend.models import ControlPoint


def compute_affine_coefficients(control_points: list[ControlPoint]) -> dict:
    """Compute affine transformation coefficients from control points.

    The affine model:
        px = a*lng + b*lat + c
        py = d*lng + e*lat + f

    Returns dict with x_coeffs [a,b,c], y_coeffs [d,e,f], and residuals.
    """
    n = len(control_points)
    if n < 3:
        raise ValueError("Need at least 3 control points")

    A = np.zeros((n, 3))
    bx = np.zeros(n)
    by = np.zeros(n)

    for i, cp in enumerate(control_points):
        A[i] = [cp.lng, cp.lat, 1.0]
        bx[i] = cp.px
        by[i] = cp.py

    # Check for collinear points (degenerate case)
    if n == 3:
        det = np.linalg.det(A)
        if abs(det) < 1e-10:
            raise ValueError(
                "Control points are collinear. Pick points that form a triangle."
            )

    x_coeffs, x_res, _, _ = np.linalg.lstsq(A, bx, rcond=None)
    y_coeffs, y_res, _, _ = np.linalg.lstsq(A, by, rcond=None)

    return {
        "x_coeffs": x_coeffs.tolist(),
        "y_coeffs": y_coeffs.tolist(),
        "x_residual": float(x_res[0]) if len(x_res) > 0 else 0.0,
        "y_residual": float(y_res[0]) if len(y_res) > 0 else 0.0,
    }


def apply_transform(
    coeffs: dict, lat: float, lng: float
) -> tuple[float, float]:
    """Convert a lat/lng to pixel coordinates using affine coefficients."""
    a, b, c = coeffs["x_coeffs"]
    d, e, f = coeffs["y_coeffs"]
    px = a * lng + b * lat + c
    py = d * lng + e * lat + f
    return (px, py)
