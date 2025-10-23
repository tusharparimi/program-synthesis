
function to_stuple(coord::Coordinate)
    return ("coord", coord.x, coord.y)
end

function to_stuple(shape::Shape)
    if shape isa Rect
        return ("rect", to_stuple(shape.bottom_left), to_stuple(shape.top_right))
    elseif shape isa Triangle
        return ("triangle", to_stuple(shape.bottom_left), to_stuple(shape.top_right))
    elseif shape isa Circle
        return ("circle", to_stuple(shape.center), shape.radius)
    elseif shape isa SUnion
        return ("union", to_stuple(shape.first), to_stuple(shape.second))
    elseif shape isa SIntersection
        return ("intersection", to_stuple(shape.first), to_stuple(shape.second))
    elseif shape isa Mirror
        return ("mirror", to_stuple(shape.shape))
    end
end

function stuple_to_string(s)
    if s isa String
        return s
    elseif s isa Int
        return string(s)
    elseif s isa Tuple
        return "(" * join(stuple_to_string.(s), " ") * ")"
    else
        error("unknown type: $(typeof(s))")
    end
end

function lex_string(s)
    res::Vector{String} = []
    hard_boundary = true
    for c in s
        if c == '('
            push!(res, "(")
            hard_boundary = true
        elseif c == ')'
            push!(res, ")")
            hard_boundary = true
        elseif c == ' '
            hard_boundary = true
            continue
        else
            if hard_boundary
                push!(res, string(c))
            else
                res[end] = res[end] * string(c)
            end
            hard_boundary = false
        end
    end
    return res
end

function string_to_stuple(s)
    tokens = lex_string(s)
    return string_to_stuple!(tokens)
end

function string_to_stuple!(tokens)
    start = popfirst!(tokens)
    if start == "("
        res = []
        while tokens[1] != ")"
            push!(res, string_to_stuple!(tokens))
        end
        popfirst!(tokens)
        return tuple(res...)
    else
        return start
    end
end

function stuple_to_prog(s)
    if s isa Tuple
        if s[1] == "coord"
            return make_coord(stuple_to_prog(s[2]), stuple_to_prog(s[3]))
        elseif s[1] == "rect"
            return make_rect(stuple_to_prog(s[2]), stuple_to_prog(s[3]))
        elseif s[1] == "triangle"
            return make_triangle(stuple_to_prog(s[2]), stuple_to_prog(s[3]))
        elseif s[1] == "circle"
            return make_circle(stuple_to_prog(s[2]), stuple_to_prog(s[3]))
        elseif s[1] == "union"
            return SUnion(stuple_to_prog(s[2]), stuple_to_prog(s[3]))
        elseif s[1] == "intersection"
            return SIntersection(stuple_to_prog(s[2]), stuple_to_prog(s[3]))
        elseif s[1] == "mirror"
            return Mirror(stuple_to_prog(s[2]))
        else
            error("unknown type: $(s[1])")
        end
    else
        fl = parse(Int, s)
        return fl
    end
end

function prog_to_str(x)
    return stuple_to_string(to_stuple(x))
end

function str_to_prog(s)
    return stuple_to_prog(string_to_stuple(s))
end
