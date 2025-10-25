include("../src/Pset1.jl")
using .Pset1

shapes::Vector{Pset1.Shape} = [
    Pset1.make_rect(Pset1.make_coord(0, 0), Pset1.make_coord(1, 1)),
    Pset1.make_triangle(Pset1.make_coord(2, 2), Pset1.make_coord(3, 3))
]

# println(typeof(shapes))

# res = Pset1.grow(shapes)
# println(length(res))
# for shape in res
#     println(shape)
# end

println(Pset1.interpretRect(shapes[1], [0.5, 0.3, 1.2], [0.5, 0.3, 1.2]))

a = [1, 2, 3, 4, 5, 6]
# for i in 1:length(a)
#     println(i)
#     deleteat!(a, length(a)-i+1)
#     println(a)
# end
i = 1
while i <= length(a)
    println(i)
    deleteat!(a, length(a)-i+1)
    println(a)
end