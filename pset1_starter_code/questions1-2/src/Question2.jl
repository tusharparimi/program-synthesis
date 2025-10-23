
using Random

function lastKDigits(n, k)
    # returns the last k digits of n, as a string
    # pads with 0s if necessary
    s = string(n)
    if length(s) < k
        s = "0"^(k - length(s)) * s
    end
    return s[end-k+1:end]
end

struct LKDTerm
    k::Int64
    augend::Int64
end

LKDProgram = Tuple{LKDTerm,LKDTerm,LKDTerm,LKDTerm}

function interpretLKDTerm(term::LKDTerm, x::Int64)
    return lastKDigits(term.augend + x, term.k)
end

function interpretLKDProgram(program::LKDProgram, x::Int64)
    return interpretLKDTerm(program[1], x) *
           interpretLKDTerm(program[2], x) *
           interpretLKDTerm(program[3], x) *
           interpretLKDTerm(program[4], x)
end

example_lkd = (Pset1.LKDTerm(2, 3), Pset1.LKDTerm(3, 537), Pset1.LKDTerm(4, 82), Pset1.LKDTerm(5, 87))

function sampleLKDProgram(seed)
    Random.seed!(seed)
    terms = []
    for i in 1:4
        k = rand(2:5)
        augend = rand(1:100_000)
        push!(terms, LKDTerm(k, augend % 10^k))
    end
    return tuple(terms...)
end

function positive_modulus(x, y)
    # returns x % y, but always positive
    return (x % y + y) % y
end


function structured(inputoutputs::Vector{Tuple{Int64,String}})::LKDProgram
    # synthesizes an LKD program that matches the given input/output pairs
    # inputoutputs is a vector of (input, output) pairs

    # Question 2
    # YOUR CODE HERE
end
