
using Random

function grow_for_testing(plist::Vector{String})
    plist_shape::Vector{Shape} = [str_to_prog(p) for p in plist]
    res_shape = grow(plist_shape)
    res = [prog_to_str(p) for p in res_shape]
    res = sort(res)
    return res
end

function test_can_solve(xs::Vector{Float64}, ys::Vector{Float64}, out::Vector{Bool}, path::String)
    println("SOLVING: ", path)
    prog = synthesize(xs, ys, out)
    println("FOUND! ", prog_to_str(prog))
    prog = str_to_prog(prog_to_str(prog)) # validate
    render_to_file(prog, path, false, xs, ys, out)
    return interpret(prog, xs, ys) == out
end


function circle_coords(x, y, r, n=6)
    theta = range(0, stop=2π, length=n)[1:end-1]
    return x .+ r .* cos.(theta), y .+ r .* sin.(theta)
end

function half_circle_test(x, y, r, eps=0.1)
    xs_true, ys_true = circle_coords(x, y, r * (1 - eps), 12)
    xs_false, ys_false = circle_coords(x, y, r * (1 + eps), 12)
    xs = vcat(xs_true, xs_false)
    ys = vcat(ys_true, ys_false)
    out = vcat(fill(true, length(xs_true)), fill(false, length(xs_false)))
    out[xs.<x] .= false
    return xs, ys, out
end

function single_circle_test(x, y, r, eps=0.1)
    xs_true, ys_true = circle_coords(x, y, r * (1 - eps))
    xs_false, ys_false = circle_coords(x, y, r * (1 + eps))
    xs = vcat(xs_true, xs_false)
    ys = vcat(ys_true, ys_false)
    out = vcat(fill(true, length(xs_true)), fill(false, length(xs_false)))
    return xs, ys, out
end

function multi_circle_test(xs, ys, rs)
    xs_out = Vector{Float64}()
    ys_out = Vector{Float64}()
    out = Vector{Bool}()
    for i in 1:length(xs)
        x, y, r = xs[i], ys[i], rs[i]
        xs_true, ys_true = circle_coords(x, y, r * (1 - 0.1))
        xs_false, ys_false = circle_coords(x, y, r * (1 + 0.1))
        xs_out = vcat(xs_out, xs_true, xs_false)
        ys_out = vcat(ys_out, ys_true, ys_false)
        out = vcat(out, fill(true, length(xs_true)), fill(false, length(xs_false)))
    end
    return xs_out, ys_out, out
end

function random_test(seed::Int, amount)
    Random.seed!(seed)
    # random float in [0, MAX_COORD]
    rand_coord() = rand(amount) * MAX_COORD
    xs = rand_coord.()::Vector{Float64}
    ys = rand_coord.()::Vector{Float64}
    out = rand(Bool, amount)::Vector{Bool}
    return xs, ys, out
end

function test_question_2(seed::Int)
    prog = sampleLKDProgram(seed)
    xs = rand(1:10000000, 100)
    ys = [interpretLKDProgram(prog, x) for x in xs]
    prog_predict = structured(
        [(xs[i], string(ys[i])) for i in 1:length(xs)]
    )
    return [interpretLKDProgram(prog_predict, x) for x in xs] == ys
end