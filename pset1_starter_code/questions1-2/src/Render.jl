
using Images

const CANVAS_SIZE = MAX_COORD
const resolution = 50

function render(shape::Shape, xs::Vector{Float64}=Vector{Float64}(), ys::Vector{Float64}=Vector{Float64}(), out::Vector{Bool}=Vector{Bool}())
    # The canvas is {0, ... 100}^2
    idxs::Vector{Float64} = collect(0:(CANVAS_SIZE*resolution)*(CANVAS_SIZE*resolution)-1)
    y = mod.(idxs, CANVAS_SIZE * resolution)
    x = div.(idxs, CANVAS_SIZE * resolution)
    x = x * (1 / resolution)
    y = y * (1 / resolution)
    # flip y
    y = y[end:-1:1]

    img = interpret(shape, x, y)
    img = reshape(img, CANVAS_SIZE * resolution, CANVAS_SIZE * resolution)

    img = colorview(Gray, img)
    img = RGB.(img)

    size = 0.125
    # draw points
    for i in 1:length(xs)
        mask = (x .>= xs[i] - size) .& (x .<= xs[i] + size) .& (y .>= ys[i] - size) .& (y .<= ys[i] + size)
        if out[i]
            img[mask] .= RGB(0, 1, 0)
        else
            img[mask] .= RGB(1, 0, 0)
        end
    end

    return img
end

function render_to_file(
    shape::Shape, filename::String, do_check::Bool=false,
    xs::Vector{Float64}=Vector{Float64}(), ys::Vector{Float64}=Vector{Float64}(), out::Vector{Bool}=Vector{Bool}()
)
    img = render(shape, xs, ys, out)
    if do_check
        load(filename) == img || error("regression in rendering of $shape to $filename")
    else
        save(filename, img)
    end
end

function render_examples(do_check::Bool=false)
    render_to_file(
        str_to_prog("(rect (coord 2 2) (coord 5 9))"),
        "render_examples/rect.png",
        do_check
    )
    render_to_file(
        str_to_prog("(triangle (coord 2 2) (coord 5 9))"),
        "render_examples/triangle.png",
        do_check
    )
    render_to_file(
        str_to_prog("(union (rect (coord 2 2) (coord 5 9)) (circle (coord 7 7) 5))"),
        "render_examples/union.png",
        do_check
    )
    render_to_file(
        str_to_prog("(intersection (rect (coord 2 2) (coord 5 9)) (circle (coord 7 7) 5))"),
        "render_examples/intersection.png",
        do_check
    )
    render_to_file(
        str_to_prog("(triangle (coord 4 3) (coord 6 5))"),
        "render_examples/triangle-single.png",
        do_check,
    )
    render_to_file(
        str_to_prog("(mirror (triangle (coord 4 3) (coord 6 5)))"),
        "render_examples/triangle-mirror.png",
        do_check,
    )
end
