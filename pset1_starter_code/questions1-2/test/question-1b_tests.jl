@test test_can_solve([1, 5, 2.5], [1, 5, 2.5], [true, true, false], "render_tests/basic_test.png")
@test test_can_solve(multi_circle_test([2], [3], [1])..., "render_tests/single_circle_test.png")
@test test_can_solve(multi_circle_test([2, 5], [3, 5], [1, 2])..., "render_tests/multi_circle_test.png")
@test test_can_solve(
    [
        # diagonal
        1, 3, 5, 7.0,
        # # bottom right triangle
        # 2, 4, 6, 8.0,
        # top left triangle (positive cases)
        1, 3, 5, 7.0,
        # top left triangle (negative cases)
        0.9, 0.9, 0.9, 0.9, 2, 4, 6, 8
    ],
    [
        # diagonal
        1, 3, 5, 7.0,
        # # bottom right triangle
        # 1, 3, 5, 7.0,
        # top left triangle (positive cases)
        2, 4, 6, 8.0,
        # top left triangle (negative cases)
        2, 4, 6, 8, 8.1, 8.1, 8.1, 8.1
    ],
    [
        # diagonal
        false, false, false, false,
        # # bottom right triangle
        # true, true, true, true,
        # top left triangle
        true, true, true, true,
        # top left triangle (negative cases)
        false, false, false, false, false, false, false, false
    ],
    "render_tests/flipped_triangle.png")
@test test_can_solve(half_circle_test(2, 3, 1)..., "render_tests/half_circle_test.png")
for i in 1:10
    @test test_can_solve(random_test(i, 6)..., "render_tests/random_$i.png")
end
@test test_can_solve([1.0, 5.0, 9.0], [9.0, 5.0, 1.0], [true, false, true], "render_tests/shapes_on_both_sides.png")
