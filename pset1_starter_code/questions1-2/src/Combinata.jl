
using MLStyle

# Represents a 2d-geometry language with primitives rect and circle and operations union and intersection.
# There is also a mirror operation that mirrors a shape across the line y=x.


MAX_COORD = 9

@data Coordinate begin
    # must be integers in range [0, MAX_COORD]
    Coord(x::Int, y::Int)
end

function make_coord(x::Int, y::Int)::Coordinate
    @assert(0 <= x <= MAX_COORD)
    @assert(0 <= y <= MAX_COORD)
    return Coord(x, y)
end

@data Shape begin
    Rect(bottom_left::Coordinate, top_right::Coordinate)
    Triangle(bottom_left::Coordinate, top_right::Coordinate)
    # radius must be an integer in range [0, MAX_COORD]
    Circle(center::Coordinate, radius::Int)
    SUnion(first::Shape, second::Shape)
    SIntersection(first::Shape, second::Shape)
    Mirror(shape::Shape)
end

function below_and_left_of(a::Coordinate, b::Coordinate)::Bool
    return a.x < b.x && a.y < b.y
end

function make_rect(bottom_left::Coordinate, top_right::Coordinate)::Shape
    @assert(below_and_left_of(bottom_left, top_right))
    return Rect(bottom_left, top_right)
end

function make_triangle(bottom_left::Coordinate, top_right::Coordinate)::Shape
    @assert(below_and_left_of(bottom_left, top_right))
    return Triangle(bottom_left, top_right)
end

function make_circle(center::Coordinate, radius::Int)::Shape
    @assert(1 <= radius <= MAX_COORD)
    return Circle(center, radius)
end