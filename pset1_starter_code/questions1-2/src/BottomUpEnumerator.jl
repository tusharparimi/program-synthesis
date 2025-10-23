

function grow(plist::Vector{Shape})::Vector{Shape}
    res::Vector{Shape} = []
    # Question 1a
    # YOUR CODE HERE
    for i in 1:length(plist)
        push!(res, plist[i])
        mirror_shape = Mirror(plist[i])
        push!(res, mirror_shape)
        for j in 1:length(plist)
            union_shape = SUnion(plist[i], plist[j])
            push!(res, union_shape)
            intersection_shape = SIntersection(plist[i], plist[j])
            push!(res, intersection_shape)
        end
    end
    return res
end

function synthesize(in_x::Vector{Float64}, in_y::Vector{Float64}, out::Vector{Bool})::Shape
    # synthesize a shape that fits the given examples
    # in_x, in_y, out are vectors of the same length
    @assert(length(in_x) == length(in_y) == length(out))
    # in_x, in_y are coordinates in the range [0, MAX_COORD]
    @assert(all(0 .<= in_x .<= MAX_COORD))
    @assert(all(0 .<= in_y .<= MAX_COORD))
    # out is a boolean vector

    # Question 1b
    # YOUR CODE HERE
    return make_circle(make_coord(5, 5), 5)
end


function elim_equivalents(plist::Vector{Shape}, in_x::Vector{Float64}, in_y::Vector{Float64})::Vector{Shape}
    # Question 1b
    # YOUR CODE HERE
    return []
end

function is_correct(p::Shape, in_x::Vector{Float64}, in_y::Vector{Float64}, out::Vector{Bool})::Bool
    return interpret(p, in_x, in_y) == out
end

function all_coordinates()::Vector{Coordinate}
    return [make_coord(x, y) for y in 0:MAX_COORD for x in 0:MAX_COORD]
end

function all_terminal_shapes()::Vector{Shape}
    res::Vector{Shape} = []
    for f in [make_rect, make_triangle]
        res = vcat(res, [f(a, b)
                         for a in all_coordinates() for b in all_coordinates()
                         if below_and_left_of(a, b)])
    end
    res = vcat(res, [make_circle(a, b) for a in all_coordinates() for b in 1:MAX_COORD])
    return res
end