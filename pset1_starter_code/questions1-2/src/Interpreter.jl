
function interpret(shape::Shape, xs, ys)
    if shape isa Rect
        return interpretRect(shape, xs, ys)
    elseif shape isa Triangle
        return interpretTriangle(shape, xs, ys)
    elseif shape isa Circle
        return interpretCircle(shape, xs, ys)
    elseif shape isa SUnion
        return interpretUnion(shape, xs, ys)
    elseif shape isa SIntersection
        return interpretIntersection(shape, xs, ys)
    elseif shape isa Mirror
        return interpretMirror(shape, xs, ys)
    end
end

function interpretRect(rect::Rect, x, y)
    return (
        (rect.bottom_left.x .<= x .<= rect.top_right.x)
        .&
        (rect.bottom_left.y .<= y .<= rect.top_right.y)
    )
end

function interpretTriangle(triangle::Triangle, x, y)
    width = triangle.top_right.x - triangle.bottom_left.x
    height = triangle.top_right.y - triangle.bottom_left.y
    m = height / width
    b = triangle.bottom_left.y - m * triangle.bottom_left.x

    below_line = y .<= m * x .+ b
    return (
        (triangle.bottom_left.x .<= x .<= triangle.top_right.x)
        .&
        (triangle.bottom_left.y .<= y .<= triangle.top_right.y)
        .&
        below_line
    )
end

function interpretCircle(circle::Circle, x, y)
    return (
        ((x .- circle.center.x) .^ 2 .+ (y .- circle.center.y) .^ 2) .<= circle.radius^2
    )
end

function interpretUnion(union::SUnion, x, y)
    return (
        interpret(union.first, x, y)
        .|
        interpret(union.second, x, y)
    )
end

function interpretIntersection(intersection::SIntersection, x, y)
    return (
        interpret(intersection.first, x, y)
        .&
        interpret(intersection.second, x, y)
    )
end

function interpretMirror(mirror::Mirror, x, y)
    return (
        interpret(mirror.shape, x, y)
        .|
        interpret(mirror.shape, y, x)
    )
end