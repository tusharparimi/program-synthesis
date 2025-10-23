using Test

include("../src/Pset1.jl");
using .Pset1

tests = [
    "internal",
    "student-q1a",
    "student-q1b",
    "student-q2"
]
if !isempty(ARGS)
    tests = ARGS  # Set list to same as command line args
end

# concatenate all test names together
test_name = join(tests, " & ")

@testset "$test_name" begin
    for t in tests
        include("$(t)_tests.jl")
    end
end
