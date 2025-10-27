
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
    lens_of_out = length(inputoutputs[1][2])
    terms = []
    j = 64
    while j >= 1
        temp = []
        for i in 2:5
            temp = [temp..., fill(i, j)...]
        end
        append!(terms, repeat(temp, div(256, j*4)))
        j = div(j, 4)
    end
    progs = reshape(terms, 256, 4)
    valid_progs = [progs[i, :] for i in 1:size(progs, 1) if sum(progs[i, :]) == lens_of_out]

    is_correct_prog = true
    lkd_prog::LKDProgram = (LKDTerm(0, 0), LKDTerm(0, 0), LKDTerm(0, 0), LKDTerm(0, 0))

    possible_lkd_progs = []
    for prog in valid_progs
        for i in 1:length(inputoutputs)
            y = []
            for p in 1:4
                till = p - 1
                idx = till == 0 ? 0 : sum(prog[1:till])
                push!(y, positive_modulus(parse(Int, inputoutputs[i][2][idx+1:idx+prog[p]]) - inputoutputs[i][1], 10^prog[p]))
            end
            lkd_prog = tuple([LKDTerm(prog[j], y[j]) for j in 1:4]...)
            if interpretLKDProgram(lkd_prog, inputoutputs[i][1]) == inputoutputs[i][2]
                push!(possible_lkd_progs, lkd_prog)
                break
            end 
        end
    end

    for lkd_prog in possible_lkd_progs
        is_correct_prog = true
        for (in, out) in inputoutputs
            if interpretLKDProgram(lkd_prog, in) != out
                is_correct_prog = false
                break
            end
        end
        if is_correct_prog
            return lkd_prog
        end
    end
    

end
