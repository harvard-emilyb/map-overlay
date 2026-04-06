from pydantic import BaseModel


class AddressInput(BaseModel):
    address: str


class GeocodedAddress(BaseModel):
    address: str
    formatted_address: str
    lat: float
    lng: float


class ControlPoint(BaseModel):
    px: float
    py: float
    lat: float
    lng: float


class TransformRequest(BaseModel):
    control_points: list[ControlPoint]
    locations: list[GeocodedAddress]


class TransformedPoint(BaseModel):
    address: str
    formatted_address: str
    lat: float
    lng: float
    px: float
    py: float


class TransformResponse(BaseModel):
    points: list[TransformedPoint]
    x_residual: float
    y_residual: float
