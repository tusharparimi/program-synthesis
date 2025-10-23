include("../src/Pset1.jl")
using .Pset1

shapes::Vector{Pset1.Shape} = [
    Pset1.make_rect(Pset1.make_coord(0, 0), Pset1.make_coord(1, 1)),
    Pset1.make_triangle(Pset1.make_coord(2, 2), Pset1.make_coord(3, 3))
]

println(typeof(shapes))

res = Pset1.grow(shapes)
println(length(res))
for shape in res
    println(shape)
end